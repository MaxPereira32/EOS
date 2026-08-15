import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { AuditTarget } from '../domain/types';
import { TargetResolver } from '../domain/target-resolver';

export class FilesystemTargetResolver implements TargetResolver {
  public canonicalizePath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string' || inputPath.trim() === '') {
      throw new Error('AuditTarget Error: Path de entrada não pode ser vazio.');
    }

    const absolutePath = path.resolve(inputPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`AuditTarget Error: O caminho '${absolutePath}' não existe.`);
    }

    let realPath = absolutePath;
    try {
      realPath = fs.realpathSync.native ? fs.realpathSync.native(absolutePath) : fs.realpathSync(absolutePath);
    } catch {
      realPath = absolutePath;
    }

    let normalized = path.normalize(realPath);

    if (process.platform === 'win32') {
      if (/^[a-z]:/i.test(normalized)) {
        normalized = normalized[0].toUpperCase() + normalized.slice(1);
      }
    }

    if (normalized.length > 3 && (normalized.endsWith('/') || normalized.endsWith('\\'))) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  public resolve(inputPath: string): AuditTarget {
    const canonicalPath = this.canonicalizePath(inputPath);

    const stat = fs.statSync(canonicalPath);
    if (!stat.isDirectory()) {
      throw new Error(`AuditTarget Error: O caminho '${canonicalPath}' não é um diretório.`);
    }

    let commitHash: string | null = null;
    let branch: string | null = null;

    try {
      const gitDir = path.join(canonicalPath, '.git');
      if (fs.existsSync(gitDir)) {
        commitHash = execSync('git rev-parse HEAD', { cwd: canonicalPath, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
        branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: canonicalPath, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
      }
    } catch {
      commitHash = null;
      branch = null;
    }

    const targetIdSeed = `${canonicalPath}:${commitHash || 'NO_GIT'}`;
    const targetId = `TGT-${crypto.createHash('sha256').update(targetIdSeed).digest('hex').slice(0, 16)}`;

    return {
      target_id: targetId,
      root_path: canonicalPath,
      repository: null,
      commit_hash: commitHash,
      branch: branch,
      metadata: {
        resolved_at: new Date().toISOString(),
      },
    };
  }
}
