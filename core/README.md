# @epubforge/core

Core library for converting web articles into high-quality EPUB files. Powers the [`epubforge`](https://www.npmjs.com/package/epubforge) CLI.

## Requirements

- Node.js ≥ 20
- [Pandoc](https://pandoc.org/installing.html) installed and available in `PATH`

```sh
# macOS
brew install pandoc

# Ubuntu/Debian
sudo apt install pandoc
```

## Installation

```sh
npm install @epubforge/core
```

Chromium is downloaded automatically via `postinstall`. If it fails, run:

```sh
npx playwright install chromium
```

## Usage

```ts
import { generateEpub } from '@epubforge/core';

const result = await generateEpub({
  url: 'https://dev.to/user/some-article',
  output: './books/',
});

console.log(result.outputPath); // './books/some-article.epub'
console.log(result.sizeBytes);  // 524288
console.log(result.title);      // 'Some Article'
```

## API

### `generateEpub(options): Promise<EpubBuildResult>`

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | URL of the article to convert (**required**) |
| `output` | `string` | `'./'` | Output path — a `.epub` file or a directory |
| `title` | `string` | auto | Override the extracted title |
| `author` | `string` | auto | Override the extracted author |
| `language` | `string` | auto | Override the language metadata (e.g. `'pt'`) |
| `cover` | `string` | auto | Path to a local cover image |
| `keepImages` | `boolean` | `true` | Download and embed images |
| `darkTheme` | `boolean` | `false` | Apply dark background CSS |
| `verbose` | `boolean` | `false` | Log debug output to stdout |

### `EpubBuildResult`

```ts
interface EpubBuildResult {
  outputPath: string;  // absolute path to the generated .epub file
  title: string;       // final title written into the EPUB metadata
  sizeBytes: number;   // file size in bytes
}
```

## Output path resolution

If `output` is a directory (or omitted), the filename is derived from the article title:

```ts
// output: './books/'  +  title: 'How JavaScript Works'
// → './books/how-javascript-works.epub'
```

If `output` ends with `.epub`, it is used as-is.

## Supported sites

Works on any article that [Mozilla Readability](https://github.com/mozilla/readability) can parse. Notable handling:

- **Medium** — uses stealth Playwright with JS blocking to read SSR content before the auth redirect fires. Free articles only; paywalled articles require a [Freedium](https://freedium.cfd) URL.
- **dev.to** — syntax-highlighted code blocks are re-highlighted by Pandoc/Skylighting after normalisation.
- **Substack**, **HackerNoon**, and most text-heavy sites work out of the box.

## Pipeline

```
URL → PlaywrightCrawler → MetadataExtractor → ReadabilityParser
    → HtmlCleaner → HtmlNormalizer → ImageDownloader → EpubBuilder → .epub
```

## License

MIT — [github.com/VitoorFranca/epubforge](https://github.com/VitoorFranca/epubforge)
