import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuditTarget, Evidence, Observation } from '../domain/types';
import { TsConfigPathsConfig } from '../resolvers/semantic-module-resolver';

export interface ManifestCollectionResult {
  readonly evidenceContext: TsConfigPathsConfig;
  readonly manifestEvidence: Evidence;
  readonly observation: Observation;
  readonly manifestHash: string;
}

/**
 * ProjectManifestCollector (FASE 4.9.4 - Multi-Manifest & Multi-TsConfig Support)
 * Coletor especializado responsável por I/O e extração de evidências contratuais:
 * - package.json (raiz e subpastas / workspaces / backend)
 * - tsconfig*.json (raiz e subpastas, paths, baseUrl)
 * - node_modules (índice físico de pacotes instalados e subpaths)
 */
export class ProjectManifestCollector {
  public static readonly collectorId = 'project-manifest-collector-v4';
  public static readonly collectorVersion = '4.9.4';

  public collect(target: AuditTarget): ManifestCollectionResult {
    const absRoot = path.resolve(target.root_path);
    const declaredPackages = new Set<string>();
    const directDependencies = new Set<string>();
    const devDependencies = new Set<string>();
    let tsconfigPaths: Record<string, string[]> = {};
    let baseUrl = '.';

    // 1. Coleta recursiva/multi-manifest de package.json
    const packageFiles = this.findFiles(absRoot, (name) => name === 'package.json');
    let pkgContentCombined = '';

    for (const pkgPath of packageFiles) {
      if (fs.existsSync(pkgPath)) {
        try {
          const raw = fs.readFileSync(pkgPath, 'utf-8');
          pkgContentCombined += raw + '|';
          const pkgContent = JSON.parse(raw);
          if (pkgContent.dependencies && typeof pkgContent.dependencies === 'object') {
            for (const k of Object.keys(pkgContent.dependencies)) {
              declaredPackages.add(k);
              directDependencies.add(k);
            }
          }
          if (pkgContent.devDependencies && typeof pkgContent.devDependencies === 'object') {
            for (const k of Object.keys(pkgContent.devDependencies)) {
              declaredPackages.add(k);
              devDependencies.add(k);
            }
          }
          if (pkgContent.peerDependencies && typeof pkgContent.peerDependencies === 'object') {
            for (const k of Object.keys(pkgContent.peerDependencies)) {
              declaredPackages.add(k);
            }
          }
          if (pkgContent.optionalDependencies && typeof pkgContent.optionalDependencies === 'object') {
            for (const k of Object.keys(pkgContent.optionalDependencies)) {
              declaredPackages.add(k);
            }
          }
        } catch {
          // ignore parse error
        }
      }
    }

    // 2. Coleta de tsconfig*.json
    const tsconfigFiles = this.findFiles(absRoot, (name) => name.startsWith('tsconfig') && name.endsWith('.json'));
    let tsconfigCombined = '';

    for (const tsconfigPath of tsconfigFiles) {
      if (fs.existsSync(tsconfigPath)) {
        try {
          const raw = fs.readFileSync(tsconfigPath, 'utf-8');
          tsconfigCombined += raw + '|';
          const sanitized = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
          const tsconfigContent = JSON.parse(sanitized);
          if (tsconfigContent.compilerOptions) {
            if (tsconfigContent.compilerOptions.baseUrl && baseUrl === '.') {
              baseUrl = tsconfigContent.compilerOptions.baseUrl;
            }
            if (tsconfigContent.compilerOptions.paths && typeof tsconfigContent.compilerOptions.paths === 'object') {
              tsconfigPaths = { ...tsconfigPaths, ...tsconfigContent.compilerOptions.paths };
            }
          }
        } catch {
          // ignore parse error
        }
      }
    }

    // 3. Índice de node_modules (raiz e subpastas)
    const installedPackages = new Set<string>();
    const installedPackageFiles = new Set<string>();
    const nodeModulesDirs = this.findDirectories(absRoot, (name) => name === 'node_modules');

    for (const nodeModulesDir of nodeModulesDirs) {
      if (fs.existsSync(nodeModulesDir)) {
        try {
          const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (entry.name.startsWith('@')) {
                const scopeDir = path.join(nodeModulesDir, entry.name);
                try {
                  const subEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
                  for (const sub of subEntries) {
                    if (sub.isDirectory()) {
                      const pkgName = entry.name + '/' + sub.name;
                      installedPackages.add(pkgName);
                      this.indexPackageFiles(path.join(scopeDir, sub.name), pkgName, installedPackageFiles);
                    }
                  }
                } catch {
                  // ignore
                }
              } else {
                installedPackages.add(entry.name);
                this.indexPackageFiles(path.join(nodeModulesDir, entry.name), entry.name, installedPackageFiles);
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const combinedRaw = pkgContentCombined + '|' + tsconfigCombined + '|' + Array.from(installedPackages).sort().join(',');
    const manifestHash = crypto.createHash('sha256').update(combinedRaw).digest('hex');

    const observation: Observation = {
      observation_id: 'OBS-MNF-' + manifestHash.slice(0, 12),
      observation_type: 'FILE_METADATA',
      source: 'package.json+tsconfig.json',
      source_hash: manifestHash,
      captured_at: new Date().toISOString(),
      collector_id: ProjectManifestCollector.collectorId,
      metadata: { root_path: absRoot },
    };

    const manifestEvidence: Evidence = {
      evidence_id: 'EVD-MNF-' + manifestHash.slice(0, 12),
      observation_id: observation.observation_id,
      collector_id: ProjectManifestCollector.collectorId,
      source_reference: 'package.json',
      locator: { relative_path: 'package.json' },
      source_hash: manifestHash,
      content_hash: manifestHash,
      snippet: '[MANIFEST] ' + declaredPackages.size + ' packages declared, ' + installedPackages.size + ' installed',
      confidence: 1.0,
      provenance: {
        target_id: target.target_id,
        collector_version: ProjectManifestCollector.collectorVersion,
      },
    };

    const evidenceContext: TsConfigPathsConfig = {
      baseUrl,
      paths: tsconfigPaths,
      knownPackages: Array.from(declaredPackages),
      installedPackages: Array.from(installedPackages),
      installedPackageFiles: Array.from(installedPackageFiles),
      manifestHash,
    };

    return {
      evidenceContext,
      manifestEvidence,
      observation,
      manifestHash,
    };
  }

  private findFiles(dir: string, predicate: (name: string) => boolean, maxDepth: number = 3): string[] {
    const results: string[] = [];
    const walk = (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.eos') {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isFile() && predicate(entry.name)) {
            results.push(fullPath);
          } else if (entry.isDirectory()) {
            walk(fullPath, depth + 1);
          }
        }
      } catch {
        // ignore
      }
    };
    walk(dir, 0);
    return results;
  }

  private findDirectories(dir: string, predicate: (name: string) => boolean, maxDepth: number = 3): string[] {
    const results: string[] = [];
    const walk = (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.eos') {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (predicate(entry.name)) {
              results.push(fullPath);
            } else {
              walk(fullPath, depth + 1);
            }
          }
        }
      } catch {
        // ignore
      }
    };
    walk(dir, 0);
    return results;
  }

  private indexPackageFiles(pkgDir: string, pkgName: string, outSet: Set<string>): void {
    try {
      const entries = fs.readdirSync(pkgDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          outSet.add(pkgName + '/' + entry.name);
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subDir = path.join(pkgDir, entry.name);
          try {
            const subFiles = fs.readdirSync(subDir);
            for (const f of subFiles) {
              outSet.add(pkgName + '/' + entry.name + '/' + f);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }
}
