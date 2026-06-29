use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};

const EPUB_CSS: &str = include_str!("epub_styles.css");

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FetchResult {
    html: String,
    final_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Article {
    title: String,
    content: String,
    excerpt: Option<String>,
    byline: Option<String>,
    lang: Option<String>,
    site_name: Option<String>,
    published_time: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EpubResult {
    output_path: String,
    title: String,
    size_bytes: u64,
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Fetches the raw HTML for a URL using Rust's HTTP client.
/// Runs in Rust so it bypasses browser CORS restrictions completely.
#[tauri::command]
async fn fetch_url(url: String) -> Result<FetchResult, String> {
    use reqwest::header;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .redirect(reqwest::redirect::Policy::limited(10))
        .gzip(true)
        .brotli(true)
        .cookie_store(true)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Falha ao criar cliente HTTP: {e}"))?;

    let response = client
        .get(&url)
        .header(header::ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header(header::ACCEPT_LANGUAGE, "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")
        .send()
        .await
        .map_err(|e| format!("Falha ao acessar a URL: {e}"))?;

    let final_url = response.url().to_string();
    let status = response.status();

    if !status.is_success() {
        return Err(format!("HTTP {status} ao acessar {url}"));
    }

    let html = response.text().await
        .map_err(|e| format!("Falha ao ler o conteúdo da página: {e}"))?;

    Ok(FetchResult { html, final_url })
}

/// Builds an EPUB file from the article extracted by Readability in the frontend.
#[tauri::command]
async fn build_epub(article: Article, output_path: String) -> Result<EpubResult, String> {
    use epub_builder::{EpubBuilder, EpubContent, ReferenceType, ZipLibrary};

    let lang = article.lang.as_deref().unwrap_or("en");
    let title_escaped = escape_html(&article.title);

    let xhtml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="{lang}">
<head>
  <meta charset="utf-8" />
  <title>{title_escaped}</title>
</head>
<body>
{content}
</body>
</html>"#,
        content = article.content,
    );

    let output = PathBuf::from(&output_path);

    let file = std::fs::File::create(&output)
        .map_err(|e| format!("Não foi possível criar o arquivo: {e}"))?;

    let mut builder = EpubBuilder::new(
        ZipLibrary::new().map_err(|e| format!("Erro ao criar zip: {e}"))?,
    )
    .map_err(|e| format!("Erro ao criar EPUB: {e}"))?;

    builder
        .metadata("title", &article.title)
        .map_err(|e| e.to_string())?;

    builder.set_lang(lang);

    if let Some(author) = &article.byline {
        let trimmed = author.trim();
        if !trimmed.is_empty() && !trimmed.starts_with('@') {
            builder.metadata("author", trimmed).map_err(|e| e.to_string())?;
        }
    }

    if let Some(desc) = &article.excerpt {
        if !desc.trim().is_empty() {
            builder.metadata("description", desc.trim()).map_err(|e| e.to_string())?;
        }
    }

    if let Some(publisher) = &article.site_name {
        if !publisher.trim().is_empty() {
            builder.metadata("publisher", publisher.trim()).map_err(|e| e.to_string())?;
        }
    }

    if let Some(date) = &article.published_time {
        builder.metadata("date", date.trim()).map_err(|e| e.to_string())?;
    }

    builder
        .stylesheet(EPUB_CSS.as_bytes())
        .map_err(|e| e.to_string())?;

    builder
        .add_content(
            EpubContent::new("content.xhtml", xhtml.as_bytes())
                .title(&article.title)
                .reftype(ReferenceType::Text),
        )
        .map_err(|e| e.to_string())?;

    builder
        .generate(file)
        .map_err(|e| format!("Erro ao gerar EPUB: {e}"))?;

    let size_bytes = std::fs::metadata(&output).map(|m| m.len()).unwrap_or(0);

    Ok(EpubResult {
        output_path,
        title: article.title,
        size_bytes,
    })
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

// ── Helpers ──────────────────────────────────────────────────────────────────

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![fetch_url, build_epub, open_path])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar a aplicação EpubForge")
}
