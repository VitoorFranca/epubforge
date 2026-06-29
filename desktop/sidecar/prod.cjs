// Production sidecar: CJS wrapper that resolves @epubforge/core via NODE_PATH.
// EPUBFORGE_NODE_MODULES env var is set by the Rust binary at spawn time,
// containing the absolute path to the workspace node_modules captured at build time.
// Node.js 22+ supports require() of ES modules without top-level await.

if (process.env.EPUBFORGE_NODE_MODULES) {
  process.env.NODE_PATH = process.env.EPUBFORGE_NODE_MODULES;
  require('module').Module._initPaths();
}

const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (...args) => process.stderr.write(...args);

const { createInterface } = require('readline');
const { generateEpub } = require('@epubforge/core');

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.once('line', async (line) => {
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
