use std::io::Cursor;
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
struct ImageRef {
    url: String,
    name: String, // local EPUB path, e.g. "images/img-0.jpg"
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Article {
    title: String,
    content: String, // pre-processed XHTML (self-closed void elements, local img srcs)
    excerpt: Option<String>,
    byline: Option<String>,
    lang: Option<String>,
    site_name: Option<String>,
    published_time: Option<String>,
    images: Vec<ImageRef>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EpubResult {
    output_path: String,
    title: String,
    size_bytes: u64,
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Fetches raw HTML via Rust's reqwest — bypasses browser CORS completely.
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

    let html = response
        .text()
        .await
        .map_err(|e| format!("Falha ao ler o conteúdo da página: {e}"))?;

    Ok(FetchResult { html, final_url })
}

/// Downloads a single image, returns (bytes, mime_type).
async fn download_image(
    client: &reqwest::Client,
    url: &str,
) -> Result<(Vec<u8>, String), String> {
    let response = client
        .get(url)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("{e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    // Use Content-Type from the response for the EPUB manifest entry
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .split(';')
        .next()
        .unwrap_or("image/jpeg")
        .trim()
        .to_string();

    if !mime.starts_with("image/") {
        return Err(format!("Resposta não é uma imagem: {mime}"));
    }

    let bytes = response.bytes().await.map_err(|e| format!("{e}"))?;
    Ok((bytes.to_vec(), mime))
}

/// Builds an EPUB from the article extracted by Readability in the frontend.
/// Downloads and embeds all images so the file works fully offline.
#[tauri::command]
async fn build_epub(article: Article, output_path: String) -> Result<EpubResult, String> {
    use epub_builder::{EpubBuilder, EpubContent, ReferenceType, ZipLibrary};

    // Strip the redundant xmlns="http://www.w3.org/1999/xhtml" that XMLSerializer
    // adds to each element (the root <html> already declares the namespace)
    let content_clean = article
        .content
        .replace(r#" xmlns="http://www.w3.org/1999/xhtml""#, "");

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
{content_clean}
</body>
</html>"#
    );

    let output = PathBuf::from(&output_path);
    let file = std::fs::File::create(&output)
        .map_err(|e| format!("Não foi possível criar o arquivo: {e}"))?;

    let mut builder = EpubBuilder::new(
        ZipLibrary::new().map_err(|e| format!("Erro ao criar zip: {e}"))?,
    )
    .map_err(|e| format!("Erro ao inicializar EPUB: {e}"))?;

    builder
        .metadata("title", &article.title)
        .map_err(|e| e.to_string())?;
    builder.set_lang(lang);

    if let Some(author) = &article.byline {
        let t = author.trim();
        if !t.is_empty() && !t.starts_with('@') {
            builder.metadata("author", t).map_err(|e| e.to_string())?;
        }
    }
    if let Some(desc) = &article.excerpt {
        let t = desc.trim();
        if !t.is_empty() {
            builder.metadata("description", t).map_err(|e| e.to_string())?;
        }
    }
    if let Some(publisher) = &article.site_name {
        let t = publisher.trim();
        if !t.is_empty() {
            builder.metadata("publisher", t).map_err(|e| e.to_string())?;
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

    // Download and embed images (failures are non-fatal — broken img is better
    // than a failed EPUB)
    if !article.images.is_empty() {
        let http = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (compatible; EpubForge)")
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .unwrap_or_default();

        for img in &article.images {
            match download_image(&http, &img.url).await {
                Ok((bytes, mime)) => {
                    let _ = builder.add_resource(&img.name, Cursor::new(bytes), mime.as_str());
                }
                Err(e) => {
                    eprintln!("Aviso: falha ao baixar imagem {}: {e}", img.url);
                }
            }
        }
    }

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
