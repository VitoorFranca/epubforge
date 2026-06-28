export interface CrawlResult {
  url: string;
  html: string;
  finalUrl: string;
}

export interface ArticleMetadata {
  title: string;
  author?: string;
  date?: string;
  language?: string;
  description?: string;
  coverUrl?: string;
  publisher?: string;
  url: string;
}

export interface ParsedArticle {
  content: string;
  title: string;
  excerpt?: string;
  byline?: string;
  length: number;
}

export interface ProcessedHtml {
  html: string;
  images: LocalImage[];
}

export interface LocalImage {
  originalSrc: string;
  localPath: string;
  filename: string;
  mimeType: string;
}

export interface EpubOptions {
  metadata: ArticleMetadata;
  content: string;
  images: LocalImage[];
  outputPath: string;
  cssPath: string;
  coverImagePath?: string;
  darkTheme?: boolean;
}

export interface CliOptions {
  url: string;
  title?: string;
  author?: string;
  output?: string;
  cover?: string;
  keepImages: boolean;
  darkTheme: boolean;
  verbose: boolean;
  language?: string;
}

export interface Importer {
  canHandle(source: string): boolean;
  import(source: string, options: ImportOptions): Promise<ParsedArticle>;
}

export interface ImportOptions {
  verbose?: boolean;
}

export interface CrawlerOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  userAgent?: string;
  verbose?: boolean;
}

export interface EpubBuildResult {
  outputPath: string;
  title: string;
  sizeBytes: number;
}
