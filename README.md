# EpubForge

Transform web articles and online content into high-quality EPUB files for e-readers (Kindle, Kobo, Boox, PocketBook, etc).

## Philosophy

EpubForge is not a generic HTML-to-EPUB converter. Its priority is generating **extremely clean, readable EPUBs** — not preserving every element of a page.

It removes ads, popups, navigation menus, sidebars, comment sections, tracking scripts, and all visual noise. Only the article content survives.

## Features

- Renders pages with a full browser (Playwright) — works with SPAs and JavaScript-heavy sites
- Extracts article content using Mozilla Readability (the same engine as Firefox Reader Mode)
- Downloads and embeds images locally — no external links in the final EPUB
- Extracts metadata automatically (title, author, date, language, description, cover image)
- Syntax-highlighted code blocks via Pandoc/Skylighting
- Generates a Table of Contents automatically
- Custom CSS optimized for e-reader typography
- Dark theme option
- EPUB3 output via Pandoc

## Requirements

- Node.js ≥ 20
- [Pandoc](https://pandoc.org/installing.html)

```sh
# macOS
brew install pandoc

# Ubuntu/Debian
sudo apt install pandoc
```

## Installation

```sh
npm install -g epubforge
```

Chromium is downloaded automatically on install. If it doesn't happen, run:

```sh
npx playwright install chromium
```

## Usage

```sh
# Basic conversion
epubforge https://dev.to/user/article

# Save to a specific directory
epubforge https://dev.to/user/article --output ~/Books/

# Save to a specific file
epubforge https://dev.to/user/article --output my-book.epub

# Override title and author
epubforge https://dev.to/user/article --title "My Book" --author "Jane Doe"

# Add a cover image
epubforge https://dev.to/user/article --cover cover.jpg

# Skip image downloading (faster, smaller file)
epubforge https://dev.to/user/article --no-keep-images

# Apply dark theme
epubforge https://dev.to/user/article --dark-theme

# Verbose output for debugging
epubforge https://dev.to/user/article --verbose

# Override language metadata
epubforge https://dev.to/user/article --language pt
```

### Medium articles

Free articles work directly:

```sh
epubforge https://medium.com/user/article-slug
```

Paywalled (member-only) articles require [Freedium](https://freedium.cfd):

```sh
epubforge https://freedium.cfd/https://medium.com/user/article-slug
```

## As a library

`@epubforge/core` can be used programmatically in any Node.js application:

```sh
npm install @epubforge/core
```

```ts
import { generateEpub } from '@epubforge/core';

const result = await generateEpub({
  url: 'https://dev.to/user/article',
  output: './books/',       // directory or .epub path (default: current dir)
  title: 'My Book',        // optional override
  author: 'Jane Doe',      // optional override
  language: 'en',          // optional override
  keepImages: true,         // default: true
  darkTheme: false,         // default: false
  verbose: false,           // default: false
});

console.log(result.outputPath);  // '/path/to/my-book.epub'
console.log(result.sizeBytes);   // 1048576
```

## Architecture

This is a monorepo with three packages:

```
epubforge/
├── core/        @epubforge/core — all business logic, usable as a library
├── cli/         epubforge       — thin CLI that calls core
└── desktop/                    — future Electron app (not yet implemented)
```

### core pipeline

```
URL
 │
 ▼
PlaywrightCrawler     — renders JavaScript, returns full HTML
 │
 ▼
MetadataExtractor     — extracts title, author, date, cover from OG/meta tags
 │
 ▼
ReadabilityParser     — strips navigation/ads, returns clean article HTML
 │
 ▼
HtmlCleaner           — removes scripts, iframes, tracking, dangerous attributes
 │
 ▼
HtmlNormalizer        — resolves URLs, normalizes headings, code blocks, tables
 │
 ▼
ImageDownloader       — downloads images, rewrites src to local paths
 │
 ▼
EpubBuilder           — calls Pandoc to generate EPUB3 with metadata and CSS
 │
 ▼
output.epub
```

### Extensibility

The `Importer` interface allows new content sources to be added without touching core:

```ts
interface Importer {
  canHandle(source: string): boolean;
  import(source: string, options?: ImportOptions): Promise<ParsedArticle>;
}
```

`MediumImporter` is the first implementation — it uses stealth Playwright with JS blocking to fetch Medium articles without triggering the auth redirect.

## Development

```sh
git clone https://github.com/VitoorFranca/epubforge.git
cd epubforge
npm install
npm run build      # builds core then cli
npm test           # runs unit tests (Vitest, core only)
npm run typecheck  # TypeScript type checking across all packages
```

## Roadmap

- [ ] Full documentation site crawler (crawl all pages → single EPUB)
- [ ] Multiple articles → single EPUB
- [ ] RSS feed → EPUB
- [ ] Markdown / DOCX → EPUB
- [ ] Desktop app (Electron)
- [ ] Web interface
- [ ] REST API

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Write tests for your changes
4. Ensure all tests pass: `npm test`
5. Ensure typecheck passes: `npm run typecheck`
6. Open a Pull Request

## License

MIT
