import type { ParsedArticle, ImportOptions } from '../types/index.js';

export interface Importer {
  canHandle(source: string): boolean;
  import(source: string, options?: ImportOptions): Promise<ParsedArticle>;
}
