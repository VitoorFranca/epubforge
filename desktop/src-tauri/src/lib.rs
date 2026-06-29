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

fn run_sidecar(
    sidecar_path: PathBuf,
    url: String,
    output_path: String,
) -> Result<GenerateResult, String> {
    let input = serde_json::json!({ "url": url, "outputPath": output_path });

    let mut cmd = Command::new("node");
    cmd.arg(&sidecar_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    // In release builds, point the CJS sidecar at the workspace node_modules
    // (path captured at compile time via build.rs / CARGO_MANIFEST_DIR).
    #[cfg(not(debug_assertions))]
    cmd.env("EPUBFORGE_NODE_MODULES", env!("EPUBFORGE_NODE_MODULES"));

    let mut child = cmd.spawn().map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Node.js não foi encontrado no PATH. \
                 Instale Node.js 20+ em https://nodejs.org"
                    .to_string()
            } else {
                format!("Não foi possível iniciar o Node.js: {e}")
            }
        })?;

    // Write JSON request and close stdin so the sidecar sees EOF.
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
