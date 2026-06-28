// IPC bridge between Tauri (Rust) and @epubforge/core (Node.js).
// Protocol: one JSON line on stdin → one JSON line on stdout.
//
// Core's Logger writes to process.stdout. We redirect it to stderr BEFORE
// any imports so it never contaminates the IPC channel.
const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (...args) => process.stderr.write(...args);

import { createInterface } from 'readline';
import { generateEpub } from '@epubforge/core';

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.once('line', async (line) => {
  rl.close();

  let request;
  try {
    request = JSON.parse(line.trim());
  } catch {
    realWrite(JSON.stringify({ success: false, error: 'Entrada JSON inválida recebida do Rust' }) + '\n');
    process.exit(1);
  }

  if (!request.url || !request.outputPath) {
    realWrite(JSON.stringify({ success: false, error: 'url e outputPath são obrigatórios' }) + '\n');
    process.exit(1);
  }

  try {
    const result = await generateEpub({
      url: request.url,
      output: request.outputPath,
    });
    realWrite(
      JSON.stringify({
        success: true,
        outputPath: result.outputPath,
        title: result.title,
        sizeBytes: result.sizeBytes,
      }) + '\n',
    );
    process.exit(0);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    realWrite(JSON.stringify({ success: false, error }) + '\n');
    process.exit(1);
  }
});

// If stdin closes without a line (e.g. Rust side crashed), exit cleanly.
rl.once('close', () => process.exit(0));
