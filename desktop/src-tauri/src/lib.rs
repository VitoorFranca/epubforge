use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerateResult {
    output_path: String,
    title: String,
    size_bytes: u64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarResponse {
    success: bool,
    output_path: Option<String>,
    title: Option<String>,
    size_bytes: Option<u64>,
    error: Option<String>,
}

/// Finds the `node` binary. GUI apps on macOS don't inherit the shell PATH,
/// so we search a list of well-known locations used by common version managers
/// (fnm, nvm, volta, homebrew, system) before giving up.
fn find_node_binary() -> Option<PathBuf> {
    // 1. Honour explicit override from the environment (e.g. in dev mode the
    //    shell has fnm's shim directory on PATH, so Command::new("node") works).
    if let Ok(output) = Command::new("node").arg("--version").output() {
        if output.status.success() {
            return Some(PathBuf::from("node"));
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();

    let candidates: &[&str] = &[
        // fnm default alias (version-independent stable symlink)
        ".local/share/fnm/aliases/default/bin/node",
        // volta
        ".volta/bin/node",
        // nvm default
        ".nvm/versions/node/default/bin/node",
        // homebrew (Apple Silicon)
        // (absolute paths — no HOME prefix)
    ];

    for rel in candidates {
        let p = PathBuf::from(&home).join(rel);
        if p.exists() {
            return Some(p);
        }
    }

    // homebrew absolute paths
    for abs in &["/opt/homebrew/bin/node", "/usr/local/bin/node", "/opt/local/bin/node"] {
        let p = PathBuf::from(abs);
        if p.exists() {
            return Some(p);
        }
    }

    // fnm: walk node-versions and pick the highest semver
    let fnm_versions = PathBuf::from(&home).join(".local/share/fnm/node-versions");
    if fnm_versions.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&fnm_versions) {
            let mut versions: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.join("installation/bin/node").exists())
                .collect();
            // sort lexicographically — good enough for vMajor.Minor.Patch strings
            versions.sort();
            if let Some(latest) = versions.last() {
                return Some(latest.join("installation/bin/node"));
            }
        }
    }

    // nvm: walk .nvm/versions/node/*/bin/node
    let nvm_versions = PathBuf::from(&home).join(".nvm/versions/node");
    if nvm_versions.is_dir() {
        let mut versions: Vec<PathBuf> = std::fs::read_dir(&nvm_versions)
            .into_iter()
            .flatten()
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.join("bin/node").exists())
            .collect();
        versions.sort();
        if let Some(latest) = versions.last() {
            return Some(latest.join("bin/node"));
        }
    }

    None
}

fn run_sidecar(
    sidecar_path: PathBuf,
    url: String,
    output_path: String,
) -> Result<GenerateResult, String> {
    let node = find_node_binary().ok_or_else(|| {
        "Node.js não foi encontrado. Instale Node.js 20+ em https://nodejs.org e reinicie o app."
            .to_string()
    })?;

    let input = serde_json::json!({ "url": url, "outputPath": output_path });

    let mut cmd = Command::new(&node);
    cmd.arg(&sidecar_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    // In release builds, point the CJS sidecar at the workspace node_modules
    // (path captured at compile time via build.rs / CARGO_MANIFEST_DIR).
    #[cfg(not(debug_assertions))]
    cmd.env("EPUBFORGE_NODE_MODULES", env!("EPUBFORGE_NODE_MODULES"));

    let mut child = cmd.spawn().map_err(|e| {
        format!("Não foi possível iniciar o Node.js ({node:?}): {e}")
    })?;

    // Write JSON request; dropping stdin closes it so the sidecar sees EOF.
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or("Falha ao obter stdin do sidecar")?;
        stdin
            .write_all(format!("{}\n", input).as_bytes())
            .map_err(|e| format!("Falha ao enviar dados para o sidecar: {e}"))?;
    }

    // Read one JSON response line from stdout.
    let stdout = child
        .stdout
        .take()
        .ok_or("Sem stdout disponível do sidecar")?;
    let mut reader = BufReader::new(stdout);
    let mut response_line = String::new();
    reader
        .read_line(&mut response_line)
        .map_err(|e| format!("Falha ao ler resposta do sidecar: {e}"))?;

    child
        .wait()
        .map_err(|e| format!("Sidecar encerrou com erro: {e}"))?;

    let trimmed = response_line.trim();
    if trimmed.is_empty() {
        return Err(
            "Sidecar não retornou nenhuma resposta. \
             Verifique se o Pandoc e o Chromium estão instalados."
                .to_string(),
        );
    }

    let response: SidecarResponse = serde_json::from_str(trimmed)
        .map_err(|e| format!("Resposta inválida do sidecar: {e}"))?;

    if response.success {
        Ok(GenerateResult {
            output_path: response.output_path.unwrap_or_default(),
            title: response.title.unwrap_or_default(),
            size_bytes: response.size_bytes.unwrap_or(0),
        })
    } else {
        Err(response.error.unwrap_or_else(|| "Erro desconhecido".to_string()))
    }
}

#[tauri::command]
async fn generate_epub(
    app: tauri::AppHandle,
    url: String,
    output_path: String,
) -> Result<GenerateResult, String> {
    let sidecar_path = resolve_sidecar_path(&app);

    tauri::async_runtime::spawn_blocking(move || {
        run_sidecar(sidecar_path, url, output_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[allow(unused_variables)]
fn resolve_sidecar_path(app: &tauri::AppHandle) -> PathBuf {
    #[cfg(debug_assertions)]
    {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sidecar/index.mjs")
    }
    #[cfg(not(debug_assertions))]
    {
        use tauri::Manager;
        app.path()
            .resource_dir()
            .expect("Não foi possível resolver o diretório de recursos")
            .join("sidecar/prod.cjs")
    }
}

#[tauri::command]
async fn open_path(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Não foi possível abrir o caminho: {e}"))?
        .wait()
        .map_err(|e| format!("Erro ao aguardar o comando open: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![generate_epub, open_path])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar a aplicação EpubForge")
}
