import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CausalityMutationResult } from '../domain/types';
import { redactOutput } from '../utils/output-redactor';

interface TextReplaceMutation {
  readonly kind: 'TEXT_REPLACE';
  readonly target: string;
  readonly search: string;
  readonly replacement: string;
  readonly expected_replacements?: number;
  readonly assertion_id: string;
  readonly control?: string;
}

interface CausalSpecDocument {
  readonly claims: Record<string, TextReplaceMutation>;
}

type ValidationState = 'PASS' | 'FAIL' | 'TIMEOUT' | 'ERROR';
interface ValidationResult {
  state: ValidationState;
  exit_code: number | null;
  stdout_sha256: string;
  stderr_sha256: string;
  assertion_status: 'PASS' | 'FAIL' | null;
  completion_kind: 'ASSERTION' | 'INFRASTRUCTURE' | 'PASS' | null;
  command_line: string;
  working_directory: string;
  duration_ms: number;
  output_excerpt: string;
}

const COPY_EXCLUDED_SEGMENTS = new Set([
  '.git',
  '.eos',
  'node_modules',
  'dist',
  'release',
  'coverage',
  '.tmp_mutation_workspace',
]);

function sha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function countOccurrences(content: string, search: string): number {
  if (!search) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = content.indexOf(search, offset);
    if (index < 0) return count;
    count++;
    offset = index + search.length;
  }
}

export class DeclaredClaimCausalityEngine {
  private readEnvironment(rootPath: string): NodeJS.ProcessEnv {
    const parsed: NodeJS.ProcessEnv = {};
    for (const filename of ['.env', '.env.local', '.env.test']) {
      const envPath = path.join(rootPath, filename);
      if (!fs.existsSync(envPath)) continue;
      for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
        const separator = normalized.indexOf('=');
        if (separator <= 0) continue;
        const key = normalized.slice(0, separator).trim();
        let value = normalized.slice(separator + 1).trim();
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        parsed[key] = value;
      }
    }
    return parsed;
  }

  private runValidation(
    workspace: string, script: string, projectEnv: NodeJS.ProcessEnv,
    claimId: string, assertionId: string, phase: 'BASELINE' | 'MUTANT',
  ): ValidationResult {
    const startedAt = Date.now();
    const nonce = crypto.randomUUID();
    const isWindows = process.platform === 'win32';
    const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd', 'run', script] : ['run', script];
    const timeoutMs = Number(process.env.EOS_CAUSAL_TIMEOUT_MS || 180000);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000)
      throw new Error('Timeout causal inválido.');
    const result = childProcess.spawnSync(command, args, {
      cwd: workspace, shell: false, windowsHide: true, stdio: 'pipe', encoding: 'utf8',
      timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024,
      env: { ...projectEnv, ...process.env, EOS_CAUSAL_VERIFICATION: '1',
        EOS_CAUSAL_CLAIM_ID: claimId, EOS_CAUSAL_ASSERTION_ID: assertionId,
        EOS_CAUSAL_NONCE: nonce, EOS_CAUSAL_PHASE: phase },
    });
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const records: any[] = [];
    let malformed = false;
    for (const line of (stdout + '\n' + stderr).split(/\r?\n/)) {
      const position = line.indexOf('EOS_CAUSAL_RECORD ');
      if (position < 0) continue;
      try { records.push(JSON.parse(line.slice(position + 18))); } catch { malformed = true; }
    }
    const bound = records.filter(record => record.version === 1 && record.nonce === nonce &&
      record.phase === phase && record.claim_id === claimId && record.assertion_id === assertionId);
    const assertions = bound.filter(record => record.type === 'ASSERTION');
    const completions = bound.filter(record => record.type === 'COMPLETION');
    const valid = !malformed && records.length === 2 && records.length === bound.length &&
      assertions.length === 1 && completions.length === 1;
    const assertion = valid ? assertions[0] : null;
    const completion = valid ? completions[0] : null;
    const timeout = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    const operational = !!result.error || !!result.signal ||
      /(?:^|\n)\s*(?:SyntaxError|TypeError|ReferenceError|RangeError|Error):/m.test(stdout + '\n' + stderr);
    const state: ValidationState = timeout ? 'TIMEOUT' : operational ? 'ERROR' :
      result.status === 0 ? 'PASS' : result.status === 1 ? 'FAIL' : 'ERROR';
    return {
      state, exit_code: result.status,
      stdout_sha256: sha256(stdout), stderr_sha256: sha256(stderr),
      assertion_status: assertion?.status === 'PASS' || assertion?.status === 'FAIL' ? assertion.status : null,
      completion_kind: completion?.kind === 'PASS' || completion?.kind === 'ASSERTION' ||
        completion?.kind === 'INFRASTRUCTURE' ? completion.kind : null,
      command_line: `npm run ${script}`,
      working_directory: workspace,
      duration_ms: Date.now() - startedAt,
      output_excerpt: redactOutput(`${stdout}\n${stderr}`).replace(/\s+/g, ' ').trim().slice(0, 500) || '(sem saída)',
    };
  }

  private copyWorkspace(rootPath: string): { tempRoot: string; workspace: string } {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-causal-'));
    const workspace = path.join(tempRoot, 'workspace');

    fs.cpSync(rootPath, workspace, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(rootPath, source);
        if (!relative) return true;
        const basename = path.basename(source);
        if (
          basename === '.env' ||
          (basename.startsWith('.env.') && !basename.endsWith('.example'))
        ) {
          return false;
        }
        return !relative.split(path.sep).some(segment => COPY_EXCLUDED_SEGMENTS.has(segment));
      },
    });

    this.linkSharedGit(rootPath, workspace);
    this.linkPackageNodeModules(rootPath, workspace);
    return { tempRoot, workspace };
  }

  private linkSharedGit(rootPath: string, workspace: string): void {
    const sourceGit = path.join(rootPath, '.git');
    if (!fs.existsSync(sourceGit)) return;
    const targetGit = path.join(workspace, '.git');
    const stat = fs.statSync(sourceGit);
    if (!stat.isDirectory()) {
      throw new Error('Workspace Git baseado em arquivo .git não é suportado na prova causal isolada.');
    }
    fs.cpSync(sourceGit, targetGit, { recursive: true });
  }

  private linkPackageNodeModules(rootPath: string, workspace: string): void {
    const visit = (sourceDir: string, targetDir: string, depth: number) => {
      if (depth > 3 || !fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) return;

      const sourceModules = path.join(sourceDir, 'node_modules');
      const targetModules = path.join(targetDir, 'node_modules');
      if (fs.existsSync(sourceModules) && !fs.existsSync(targetModules)) {
        fs.symlinkSync(
          sourceModules,
          targetModules,
          process.platform === 'win32' ? 'junction' : 'dir',
        );
      }

      for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || COPY_EXCLUDED_SEGMENTS.has(entry.name) || entry.name.startsWith('.')) {
          continue;
        }
        visit(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), depth + 1);
      }
    };

    visit(rootPath, workspace, 0);
  }

  public evaluateCausality(
    rootPath: string,
    claimId: string,
    targetArtifact: string,
    validationScript: string,
    causalSpecPath: string,
  ): CausalityMutationResult {
    const withinRoot = (value: string): boolean => {
      if (typeof value !== 'string' || !value || path.isAbsolute(value)) return false;
      const relative = path.relative(path.resolve(rootPath), path.resolve(rootPath, value));
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
      if (!fs.existsSync(path.resolve(rootPath, value))) return false;
      const realRelative = path.relative(fs.realpathSync(rootPath), fs.realpathSync(path.resolve(rootPath, value)));
      return !!realRelative && !realRelative.startsWith('..') && !path.isAbsolute(realRelative);
    };
    if (!withinRoot(targetArtifact) || !withinRoot(causalSpecPath) ||
      !/^[A-Za-z0-9:_-]+$/.test(validationScript)) {
      return { mutation_id: `MUT-${claimId}-INVALID-INPUT`, target_artifact: targetArtifact,
        mutation_description: 'Caminho ou script causal inválido.', original_status: 'PASS',
        mutated_status: 'PASS', causality_proven: false, rationale: 'FALHA DE CAUSALIDADE: entrada fora do contrato.' };
    }
    const originalTarget = path.resolve(rootPath, targetArtifact);
    const specFile = path.resolve(rootPath, causalSpecPath);

    if (!fs.existsSync(originalTarget) || !fs.existsSync(specFile)) {
      return {
        mutation_id: `MUT-${claimId}-NOT-AVAILABLE`,
        target_artifact: targetArtifact,
        mutation_description: 'Spec causal ou artefato-alvo ausente.',
        original_status: 'PASS',
        mutated_status: 'PASS',
        causality_proven: false,
        rationale: 'FALHA DE CAUSALIDADE: spec causal ou artefato-alvo não está disponível.',
      };
    }

    let spec: CausalSpecDocument;
    try {
      spec = JSON.parse(fs.readFileSync(specFile, 'utf8')) as CausalSpecDocument;
    } catch {
      return {
        mutation_id: `MUT-${claimId}-INVALID-SPEC`,
        target_artifact: targetArtifact,
        mutation_description: 'Spec causal inválido.',
        original_status: 'PASS',
        mutated_status: 'PASS',
        causality_proven: false,
        rationale: 'FALHA DE CAUSALIDADE: causal_spec não contém JSON válido.',
      };
    }

    const mutation = spec?.claims?.[claimId];
    if (!mutation || mutation.kind !== 'TEXT_REPLACE' || mutation.target !== targetArtifact ||
      typeof mutation.search !== 'string' || !mutation.search || typeof mutation.replacement !== 'string' ||
      typeof mutation.assertion_id !== 'string' || !mutation.assertion_id.trim() ||
      !Number.isSafeInteger(mutation.expected_replacements ?? 1) || (mutation.expected_replacements ?? 1) < 1) {
      return {
        mutation_id: `MUT-${claimId}-UNMAPPED`,
        target_artifact: targetArtifact,
        mutation_description: 'Claim sem mutação TEXT_REPLACE compatível com o target.',
        original_status: 'PASS',
        mutated_status: 'PASS',
        causality_proven: false,
        rationale: 'FALHA DE CAUSALIDADE: o claim não possui mutação declarada compatível com seu artefato-alvo.',
      };
    }

    const originalBytes = fs.readFileSync(originalTarget);
    const originalHash = sha256(originalBytes);
    const projectEnv = this.readEnvironment(rootPath);
    let tempRoot: string | null = null;

    try {
      const isolated = this.copyWorkspace(rootPath);
      tempRoot = isolated.tempRoot;
      const workspaceTarget = path.resolve(isolated.workspace, targetArtifact);
      const assertIsolatedTarget = () => {
        const relative = path.relative(fs.realpathSync(isolated.workspace), fs.realpathSync(workspaceTarget));
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
          throw new Error('Artefato causal copiado escapa do workspace isolado.');
      };
      assertIsolatedTarget();

      const baseline = this.runValidation(isolated.workspace, validationScript, projectEnv,
        claimId, mutation.assertion_id, 'BASELINE');
      if (baseline.state !== 'PASS' || baseline.assertion_status !== 'PASS' || baseline.completion_kind !== 'PASS') {
        return {
          mutation_id: `MUT-${claimId}-BASELINE-NOT-GREEN`,
          target_artifact: targetArtifact,
          mutation_description: 'Baseline isolado deve passar antes da mutação.',
          original_status: 'FAIL',
          mutated_status: 'PASS',
          causality_proven: false,
          rationale: baseline.state === 'TIMEOUT'
            ? 'FALHA DE CAUSALIDADE: baseline isolado excedeu o timeout.'
            : 'FALHA DE CAUSALIDADE: baseline isolado não passou; não é possível atribuir falha à mutação.',
        };
      }

      const content = fs.readFileSync(workspaceTarget, 'utf8');
      const expected = mutation.expected_replacements ?? 1;
      const occurrences = countOccurrences(content, mutation.search);
      if (occurrences !== expected) {
        return {
          mutation_id: `MUT-${claimId}-NOT-APPLIED`,
          target_artifact: targetArtifact,
          mutation_description: 'Mutação declarada não encontrou exatamente o número esperado de ocorrências.',
          original_status: 'PASS',
          mutated_status: 'PASS',
          causality_proven: false,
          rationale: `FALHA DE CAUSALIDADE: esperado ${expected} match(es), encontrado(s) ${occurrences}.`,
        };
      }

      const mutated = content.split(mutation.search).join(mutation.replacement);
      if (mutated === content) {
        return {
          mutation_id: `MUT-${claimId}-NOOP`,
          target_artifact: targetArtifact,
          mutation_description: 'Mutação declarada não alterou o artefato.',
          original_status: 'PASS',
          mutated_status: 'PASS',
          causality_proven: false,
          rationale: 'FALHA DE CAUSALIDADE: mutação NOOP.',
        };
      }

      assertIsolatedTarget();
      fs.writeFileSync(workspaceTarget, mutated, 'utf8');
      const mutatedResult = this.runValidation(isolated.workspace, validationScript, projectEnv,
        claimId, mutation.assertion_id, 'MUTANT');
      if (mutatedResult.state === 'TIMEOUT') {
        return {
          mutation_id: `MUT-${claimId}-TIMEOUT`,
          target_artifact: targetArtifact,
          mutation_description: 'Mutação aplicada, porém a validação mutada excedeu o timeout.',
          original_status: 'PASS',
          mutated_status: 'PASS',
          causality_proven: false,
          rationale: 'FALHA DE CAUSALIDADE: timeout não é aceito como mutação morta.',
        };
      }

      const killed = mutatedResult.state === 'FAIL' && mutatedResult.assertion_status === 'FAIL' &&
        mutatedResult.completion_kind === 'ASSERTION';
      return {
        mutation_id: `MUT-${claimId}-TEXT-REPLACE`,
        target_artifact: targetArtifact,
        mutation_description: 'Mutação textual exata aplicada em workspace isolado e validada pela mesma suíte.',
        original_status: 'PASS',
        mutated_status: killed ? 'FAIL' : 'PASS',
        causality_proven: killed,
        validation_evidence: { assertion_id: mutation.assertion_id, baseline, mutant: mutatedResult,
          original_target_sha256: originalHash, mutant_target_sha256: sha256(mutated),
          spec_sha256: sha256(fs.readFileSync(specFile)) },
        rationale: killed
          ? 'CAUSALIDADE PROVADA: assertion identificada passou no baseline e falhou no mutante, com conclusão estruturada e sem erro operacional.'
          : 'FALHA DE CAUSALIDADE: assertion esperada não falhou de forma comprovada; validação continuou passando ou houve evidência inválida/falha operacional.',
      };
    } catch (error) {
      return {
        mutation_id: `MUT-${claimId}-ENGINE-ERROR`,
        target_artifact: targetArtifact,
        mutation_description: 'Falha operacional durante prova causal isolada.',
        original_status: 'PASS',
        mutated_status: 'PASS',
        causality_proven: false,
        rationale: `FALHA DE CAUSALIDADE: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      if (tempRoot && fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
      if (!fs.existsSync(originalTarget) || sha256(fs.readFileSync(originalTarget)) !== originalHash) {
        throw new Error('FALHA CRÍTICA DE INTEGRIDADE: artefato original mudou durante a prova causal.');
      }
    }
  }
}
