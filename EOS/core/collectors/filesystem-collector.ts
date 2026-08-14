import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuditTarget, FileArtifact, Observation, Evidence, CoverageMetrics } from '../domain/types';

export interface CollectionResult {
  readonly observations: readonly Observation[];
  readonly evidences: readonly Evidence[];
  readonly artifacts: readonly FileArtifact[];
  readonly coverage: CoverageMetrics;
}

export class FilesystemCollector {
  private readonly collectorId = 'filesystem-collector-v3';
  private readonly collectorVersion = '3.2.0';
  private readonly defaultIgnoredDirs = ['.git', 'node_modules', 'dist', 'build', '.eos'];
  private readonly maxFileSize = 50 * 1024 * 1024; // 50 MB

  public static isPathContained(rootPath: string, candidatePath: string): boolean {
    const normRoot = path.normalize(rootPath);
    const normCand = path.normalize(candidatePath);

    const rel = path.relative(normRoot, normCand);
    const isRelContained = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    if (!isRelContained) return false;

    // Se o candidato existir, checar também sua identidade real resolvida
    try {
      if (fs.existsSync(normCand)) {
        const realRoot = fs.realpathSync.native ? fs.realpathSync.native(normRoot) : fs.realpathSync(normRoot);
        const realCand = fs.realpathSync.native ? fs.realpathSync.native(normCand) : fs.realpathSync(normCand);
        const realRel = path.relative(realRoot, realCand);
        return realRel === '' || (!realRel.startsWith('..') && !path.isAbsolute(realRel));
      }
    } catch {
      // Se realpathSync falhar, mantemos a negação de segurança se rel não for contido
    }

    return true;
  }

  private computeSha256Stream(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }

  public async collect(target: AuditTarget): Promise<CollectionResult> {
    const rootPath = target.root_path;
    const artifacts: FileArtifact[] = [];
    const observations: Observation[] = [];
    const evidences: Evidence[] = [];

    let filesDiscovered = 0;
    let filesAnalyzed = 0;
    let filesSkipped = 0;
    let filesErrored = 0;
    let filesInaccessible = 0;

    let directoriesDiscovered = 0;
    let directoriesSkipped = 0;
    let symlinksDiscovered = 0;
    let symlinksSkipped = 0;

    const visitedRealDirectories = new Set<string>();

    // Registrar o root_path real para prevenção de ciclos
    try {
      const realRoot = fs.realpathSync.native ? fs.realpathSync.native(rootPath) : fs.realpathSync(rootPath);
      visitedRealDirectories.add(realRoot);
    } catch {
      visitedRealDirectories.add(rootPath);
    }

    const traverse = async (currentDir: string) => {
      directoriesDiscovered++;

      // I-FS-001: Containment Check
      if (!FilesystemCollector.isPathContained(rootPath, currentDir)) {
        directoriesSkipped++;
        return;
      }

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err: any) {
        directoriesSkipped++;
        filesErrored++;
        filesDiscovered++; // Para manter a conservação de arquivos se falhar
        artifacts.push({
          relative_path: path.relative(rootPath, currentDir).replace(/\\/g, '/'),
          absolute_path: currentDir,
          file_extension: '',
          size_bytes: 0,
          sha256_hash: '',
          status: 'ERROR',
          error_message: `Falha ao ler diretório: ${err.message}`,
        });
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

        // Contenção estrita
        if (!FilesystemCollector.isPathContained(rootPath, fullPath)) {
          filesInaccessible++;
          filesDiscovered++;
          continue;
        }

        // --- TRATAMENTO DE DIRETÓRIOS ---
        if (entry.isDirectory()) {
          if (this.defaultIgnoredDirs.includes(entry.name)) {
            directoriesSkipped++;
            continue;
          }

          // Prevenção de ciclo de diretório via realpathSync
          let realDir = fullPath;
          try {
            realDir = fs.realpathSync.native ? fs.realpathSync.native(fullPath) : fs.realpathSync(fullPath);
          } catch {
            realDir = fullPath;
          }

          if (visitedRealDirectories.has(realDir)) {
            directoriesSkipped++;
            continue;
          }

          visitedRealDirectories.add(realDir);
          await traverse(fullPath);

        // --- TRATAMENTO DE SYMLINKS ---
        } else if (entry.isSymbolicLink()) {
          symlinksDiscovered++;
          let isSymlinkDir = false;
          let realTarget = fullPath;

          try {
            realTarget = fs.realpathSync.native ? fs.realpathSync.native(fullPath) : fs.realpathSync(fullPath);
            const targetStat = fs.statSync(realTarget);
            if (targetStat.isDirectory()) {
              isSymlinkDir = true;
            }
          } catch {
            // Symlink quebrado
            symlinksSkipped++;
            filesErrored++;
            filesDiscovered++;
            artifacts.push({
              relative_path: relPath,
              absolute_path: fullPath,
              file_extension: path.extname(fullPath),
              size_bytes: 0,
              sha256_hash: '',
              status: 'ERROR',
              error_message: 'Symlink quebrado ou inacessível.',
            });
            continue;
          }

          // I-FS-002: Symlink Termination Policy
          // Symlinks para diretórios NUNCA são percorridos recursivamente por padrão
          if (isSymlinkDir) {
            symlinksSkipped++;
            continue;
          }

          // Symlinks para arquivos externos ao root
          if (!FilesystemCollector.isPathContained(rootPath, realTarget)) {
            symlinksSkipped++;
            filesInaccessible++;
            filesDiscovered++;
            artifacts.push({
              relative_path: relPath,
              absolute_path: fullPath,
              file_extension: path.extname(fullPath),
              size_bytes: 0,
              sha256_hash: '',
              status: 'IGNORED',
              error_message: 'Symlink apontando para arquivo fora do root_path.',
            });
            continue;
          }

          // Symlink apontando para arquivo interno: tratar como arquivo
          await processFile(fullPath, relPath);

        // --- TRATAMENTO DE ARQUIVOS REGULARES ---
        } else if (entry.isFile()) {
          await processFile(fullPath, relPath);
        }
      }
    };

    const processFile = async (fullPath: string, relPath: string) => {
      filesDiscovered++;

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch (err: any) {
        filesErrored++;
        artifacts.push({
          relative_path: relPath,
          absolute_path: fullPath,
          file_extension: path.extname(fullPath),
          size_bytes: 0,
          sha256_hash: '',
          status: 'ERROR',
          error_message: `Erro ao obter stats: ${err.message}`,
        });
        return;
      }

      // I-FS-003: Bounded Memory & Large File Policy
      if (stat.size > this.maxFileSize) {
        filesSkipped++;
        artifacts.push({
          relative_path: relPath,
          absolute_path: fullPath,
          file_extension: path.extname(fullPath),
          size_bytes: stat.size,
          sha256_hash: '',
          status: 'IGNORED',
          error_message: `Arquivo excede o limite de tamanho MAX_FILE_SIZE (${this.maxFileSize / (1024 * 1024)}MB).`,
        });
        return;
      }

      try {
        // Hashing incremental via Stream
        const sha256 = await this.computeSha256Stream(fullPath);
        const ext = path.extname(fullPath);

        artifacts.push({
          relative_path: relPath,
          absolute_path: fullPath,
          file_extension: ext,
          size_bytes: stat.size,
          sha256_hash: sha256,
          status: 'ACCESSIBLE',
        });

        const obsId = `OBS-FS-${crypto.createHash('md5').update(`${target.target_id}:${relPath}`).digest('hex').slice(0, 12)}`;
        observations.push({
          observation_id: obsId,
          observation_type: 'FILE_METADATA',
          source: relPath,
          source_hash: sha256,
          captured_at: new Date().toISOString(),
          collector_id: this.collectorId,
          metadata: {
            size_bytes: String(stat.size),
            extension: ext,
          },
        });

        const evdId = `EVD-FS-${crypto.createHash('md5').update(`${obsId}:${sha256}`).digest('hex').slice(0, 12)}`;
        evidences.push({
          evidence_id: evdId,
          observation_id: obsId,
          collector_id: this.collectorId,
          source_reference: relPath,
          locator: { relative_path: relPath },
          source_hash: sha256,
          content_hash: sha256,
          snippet: `File: ${relPath} (Size: ${stat.size} bytes, SHA256: ${sha256.slice(0, 12)}...)`,
          confidence: 1.0,
          provenance: {
            target_id: target.target_id,
            collector_version: this.collectorVersion,
          },
        });

        filesAnalyzed++;
      } catch (err: any) {
        filesErrored++;
        artifacts.push({
          relative_path: relPath,
          absolute_path: fullPath,
          file_extension: path.extname(fullPath),
          size_bytes: stat.size,
          sha256_hash: '',
          status: 'ERROR',
          error_message: `Erro ao ler arquivo via stream: ${err.message}`,
        });
      }
    };

    await traverse(rootPath);

    const coverage: CoverageMetrics = {
      files_discovered: filesDiscovered,
      files_analyzed: filesAnalyzed,
      files_skipped: filesSkipped,
      files_errored: filesErrored,
      files_inaccessible: filesInaccessible,
      directories_discovered: directoriesDiscovered,
      directories_skipped: directoriesSkipped,
      symlinks_discovered: symlinksDiscovered,
      symlinks_skipped: symlinksSkipped,
    };

    return { observations, evidences, artifacts, coverage };
  }
}
