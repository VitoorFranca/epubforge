export type Status =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'done'; title: string; outputPath: string };

export interface GenerateResult {
  outputPath: string;
  title: string;
  sizeBytes: number;
}
