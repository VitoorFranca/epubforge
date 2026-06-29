export type Status =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'done'; title: string; outputPath: string };

export interface GenerateResult {
  outputPath: string;
  title: string;
  sizeBytes: number;
}

export interface UrlRule {
  id: string;
  name: string;
  domain: string;
  prefix: string;
}

export interface Settings {
  defaultFolder: string | null;
  autoOpenEpub: boolean;
  autoOpenFolder: boolean;
  urlRules: UrlRule[];
}

export const DEFAULT_SETTINGS: Settings = {
  defaultFolder: null,
  autoOpenEpub: false,
  autoOpenFolder: false,
  urlRules: [],
};
