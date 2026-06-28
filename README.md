# EpubForge

Transform web articles, documentation, and online content into high-quality EPUB files for e-readers (Kindle, Kobo, Boox, PocketBook, etc).

## Philosophy

EpubForge is not a generic HTML-to-EPUB converter. Its priority is generating **extremely clean, readable EPUBs** — not preserving every element of a page.

It removes ads, popups, navigation menus, sidebars, comment sections, tracking scripts, and all visual noise. Only the article content survives.

## Features

- Renders pages with a full browser (Playwright) — works with SPAs and JavaScript-heavy sites
- Extracts article content using Mozilla Readability (the same engine as Firefox Reader Mode)
- Downloads and embeds images locally — no external links in the final EPUB
- Extracts metadata automatically (title, author, date, language, description, cover image)
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
npx playwright install chromium
```

Or clone and build from source:

```sh
git clone https://github.com/yourusername/epubforge
cd epubforge
npm install
npx playwright install chromium
npm run build
npm link
```

## Usage

```sh
# Basic conversion
epubforge https://example.com/article

# Override title and author
epubforge https://example.com/article --title "My Book" --author "Jane Doe"

# Custom output path
epubforge https://example.com/article --output my-book.epub

# Add a cover image
epubforge https://example.com/article --cover cover.jpg

# Skip image downloading
epubforge https://example.com/article --no-keep-images

# Apply dark theme
epubforge https://example.com/article --dark-theme

# Verbose output for debugging
epubforge https://example.com/article --verbose

# Override language
epubforge https://example.com/article --language pt
```

## Architecture

```
src/
├── cli/               # Entry point, argument parsing (Commander)
├── crawler/           # Page rendering (Playwright)
├── extractor/         # Importer interface + ArticleExtractor
├── readability/       # Content extraction (Mozilla Readability + JSDOM)
├── html/              # HtmlCleaner, HtmlNormalizer, ImageDownloader
├── metadata/          # MetadataExtractor (OG, schema.org, heuristics)
├── epub/              # EPUB generation (Pandoc)
│   └── assets/        # Reader CSS stylesheet
├── utils/             # Logger, slugify, tempDir, mimeType
└── types/             # Shared TypeScript types
```

### Data Flow

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

The `Importer` interface allows new content sources to be added without touching the core:

```ts
interface Importer {
  canHandle(source: string): boolean;
  import(source: string, options?: ImportOptions): Promise<ParsedArticle>;
}
```

Planned importers: `DocumentationImporter`, `PdfImporter`, `MarkdownImporter`, `HtmlImporter`.

## Development

```sh
npm test           # Run unit tests (Vitest)
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # Compile to dist/
npm run dev -- https://example.com/article  # Run without building
```

## Roadmap

- [ ] Full documentation site crawler (crawl all pages → single EPUB book)
- [ ] Multiple articles → single EPUB book
- [ ] PDF → EPUB
- [ ] Markdown → EPUB
- [ ] DOCX → EPUB
- [ ] RSS feed → EPUB
- [ ] AI chapter summarization
- [ ] AI cover generation
- [ ] Kindle sync
- [ ] Kobo sync
- [ ] Web interface
- [ ] Desktop app
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
