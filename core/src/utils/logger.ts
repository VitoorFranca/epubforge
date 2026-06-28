export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export class Logger {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message: string): void {
    process.stdout.write(`  ${message}\n`);
  }

  success(message: string): void {
    process.stdout.write(`✓ ${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`⚠ ${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`✗ ${message}\n`);
  }

  debug(message: string): void {
    if (this.verbose) {
      process.stdout.write(`  [debug] ${message}\n`);
    }
  }

  step(step: number, total: number, message: string): void {
    process.stdout.write(`[${step}/${total}] ${message}\n`);
  }
}
