import * as fs from 'fs';
import * as crypto from 'crypto';

export interface FileOperationAdapter {
  exists(filePath: string): boolean;
  read(filePath: string): string;
  hash(content: string): string;
  withLock(filePath: string, fn: () => void): void;
}

export class NativeFileOperationAdapter implements FileOperationAdapter {
  public exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  public read(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  public hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public withLock(filePath: string, fn: () => void): void {
    const lockPath = `${filePath}.lock`;
    let lockFd: number | undefined;

    try {
      lockFd = fs.openSync(lockPath, 'wx');
      fn();
    } finally {
      if (lockFd !== undefined) {
        try { fs.closeSync(lockFd); } catch {}
        try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch {}
      }
    }
  }
}
