import * as crypto from 'crypto';
import * as path from 'path';
import { TargetResolver } from '../domain/target-resolver';
import { FilesystemCollector } from '../collectors/filesystem-collector';
import { TypescriptAstCollector } from '../collectors/typescript-ast-collector';
import { ProjectManifestCollector } from '../collectors/project-manifest-collector';
import { FileStructureFactProvider } from '../fact-providers/file-structure-fact-provider';
import { DependencyFactProvider } from '../fact-providers/dependency-fact-provider';
import { MandatoryDirectoryRule } from '../rules/mandatory-directory-rule';
import { NoDisallowedDependencyRule } from '../rules/no-disallowed-dependency-rule';
import { JsonReporter } from '../reporters/json-reporter';
import { MarkdownReporter } from '../reporters/markdown-reporter';
import { AuditReport, Finding, RuleEvaluationResult, Evidence, Fact, FormalEvidence, SecurityClaimEvaluation, ExecutionEvidence, RlsExecutionRecord } from '../domain/types';
import { FirestoreSecurityEngine } from '../engines/firestore-security-engine';
import { CausalityMutationEngine } from '../engines/causality-mutation-engine';
import { DeclaredClaimCausalityEngine } from '../engines/declared-claim-causality-engine';
import { RlsClaimEngine } from '../engines/rls-claim-engine';
import { GeneratedAppSecurityEngine } from '../engines/generated-app-security-engine';
import { HardQualityGateEngine } from '../engines/hard-quality-gate-engine';
import { GovernorIntegrityVerifier } from '../utils/governor-integrity-verifier';
import { redactOutput } from '../utils/output-redactor';
import { ReportIntegritySigner } from '../utils/report-integrity-signer';
import { FirestoreDomainAdapter } from '../adapters/firestore/firestore-domain-adapter';
import { EvidenceEnvelope } from '../domain/universal-contracts';

/**
 * Lê a convenção arquitetural declarada pelo projeto em eos.risk.yml
 * (chave: architecture.domain_directory). Parsing mínimo por regex, sem
 * dependência de biblioteca YAML. Ausente/inválido => default 'src/domain'.
 */
function readDeclaredDomainDirectory(rootPath: string): string {
  try {
    const riskPath = path.join(rootPath, 'eos.risk.yml');
    if (!require('fs').existsSync(riskPath)) return 'src/domain';
    const content = require('fs').readFileSync(riskPath, 'utf8');
    const match = content.match(/domain_directory\s*:\s*["']?([^"'\s#]+)/);
    return match ? match[1] : 'src/domain';
  } catch {
    return 'src/domain';
  }
}

function readDeclaredProductionValidationScript(rootPath: string): string | null {
  try {
    const riskPath = path.join(rootPath, 'eos.risk.yml');
    if (!require('fs').existsSync(riskPath)) return null;
    const content = require('fs').readFileSync(riskPath, 'utf8');
    const match = content.match(/release_validation_script\s*:\s*["']?([^"'\s#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

interface DeclaredExecutionTimeoutConfig {
  defaultTimeoutMs: number | null;
  checkTimeoutsMs: Record<string, number>;
}

const MIN_EXECUTION_TIMEOUT_MS = 100;
const MAX_EXECUTION_TIMEOUT_MS = 15 * 60_000;

function parseExecutionTimeout(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed)
    && parsed >= MIN_EXECUTION_TIMEOUT_MS
    && parsed <= MAX_EXECUTION_TIMEOUT_MS
    ? parsed
    : null;
}

function readDeclaredExecutionTimeoutConfig(rootPath: string): DeclaredExecutionTimeoutConfig {
  const result: DeclaredExecutionTimeoutConfig = {
    defaultTimeoutMs: null,
    checkTimeoutsMs: {},
  };
  try {
    const riskPath = path.join(rootPath, 'eos.risk.yml');
    if (!require('fs').existsSync(riskPath)) return result;
    const lines = require('fs').readFileSync(riskPath, 'utf8').split(/\r?\n/);
    let inExecution = false;
    let inCheckTimeouts = false;

    for (const line of lines) {
      if (/^execution\s*:/.test(line)) {
        inExecution = true;
        inCheckTimeouts = false;
        continue;
      }
      if (!inExecution) continue;
      if (/^[^\s#][^:]*\s*:/.test(line)) break;

      const defaultMatch = line.match(/^\s+default_timeout_ms\s*:\s*(\d+)\s*(?:#.*)?$/);
      if (defaultMatch) {
        result.defaultTimeoutMs = parseExecutionTimeout(defaultMatch[1]);
        continue;
      }
      if (/^\s+check_timeouts_ms\s*:/.test(line)) {
        inCheckTimeouts = true;
        continue;
      }
      if (!inCheckTimeouts) continue;

      const checkMatch = line.match(/^\s+(?:"([^"]+)"|'([^']+)'|([^:#][^:]*?))\s*:\s*(\d+)\s*(?:#.*)?$/);
      if (!checkMatch) continue;
      const checkName = (checkMatch[1] || checkMatch[2] || checkMatch[3] || '').trim();
      const timeout = parseExecutionTimeout(checkMatch[4]);
      if (checkName && timeout !== null) result.checkTimeoutsMs[checkName] = timeout;
    }
    return result;
  } catch {
    return result;
  }
}

interface DeclaredSecurityClaimConfig {
  id: string;
  status: string;
  claimType: string;
  target: string;
  validationScript: string | null;
  causalSpecPath: string | null;
  rlsResource: string | null;
  rlsIsolationAssertionId: string | null;
  evidencePaths: string[];
}

function readDeclaredActiveSecurityClaims(rootPath: string): DeclaredSecurityClaimConfig[] {
  try {
    const riskPath = path.join(rootPath, 'eos.risk.yml');
    if (!require('fs').existsSync(riskPath)) return [];
    const lines = require('fs').readFileSync(riskPath, 'utf8').split(/\r?\n/);
    const claims: DeclaredSecurityClaimConfig[] = [];
    let inSecurityClaims = false;
    let current: DeclaredSecurityClaimConfig | null = null;
    let inEvidence = false;

    const flush = () => {
      if (current?.id && current.status.toUpperCase() === 'ACTIVE') {
        claims.push({
          ...current,
          evidencePaths: Array.from(new Set(current.evidencePaths)),
        });
      }
    };

    for (const line of lines) {
      if (/^security_claims\s*:/.test(line)) {
        inSecurityClaims = true;
        current = null;
        continue;
      }
      if (!inSecurityClaims) continue;
      if (/^[^\s#][^:]*\s*:/.test(line)) {
        flush();
        current = null;
        inSecurityClaims = false;
        break;
      }

      const idMatch = line.match(/^\s*-\s+id\s*:\s*["']?([^"'#]+?)["']?\s*$/);
      if (idMatch) {
        flush();
        current = {
          id: idMatch[1].trim(),
          status: '',
          claimType: '',
          target: '',
          validationScript: null,
          causalSpecPath: null,
          rlsResource: null,
          rlsIsolationAssertionId: null,
          evidencePaths: [],
        };
        inEvidence = false;
        continue;
      }
      if (!current) continue;

      const statusMatch = line.match(/^\s+status\s*:\s*["']?([^"'\s#]+)/);
      if (statusMatch) {
        current.status = statusMatch[1].trim();
        continue;
      }
      const targetMatch = line.match(/^\s+target\s*:\s*["']?([^"'#]+?)["']?\s*$/);
      if (targetMatch) {
        current.target = targetMatch[1].trim();
        continue;
      }
      const typeMatch = line.match(/^\s+type\s*:\s*["']?([^"'\s#]+)/);
      if (typeMatch) {
        current.claimType = typeMatch[1].trim().toUpperCase();
        continue;
      }
      if (/^\s+evidence\s*:/.test(line)) {
        inEvidence = true;
        continue;
      }
      if (inEvidence) {
        const validationMatch = line.match(/^\s+validation_script\s*:\s*["']?([^"'\s#]+)/);
        if (validationMatch) {
          current.validationScript = validationMatch[1].trim();
          continue;
        }
        const causalSpecMatch = line.match(/^\s+causal_spec\s*:\s*["']?([^"'\s#]+)/);
        if (causalSpecMatch) {
          current.causalSpecPath = causalSpecMatch[1].trim();
          current.evidencePaths.push(causalSpecMatch[1].trim());
          continue;
        }
        const rlsResourceMatch = line.match(/^\s+rls_resource\s*:\s*["']?([^"'#]+?)["']?\s*$/);
        if (rlsResourceMatch) {
          current.rlsResource = rlsResourceMatch[1].trim();
          continue;
        }
        const rlsAssertionMatch = line.match(/^\s+rls_isolation_assertion_id\s*:\s*["']?([^"'\s#]+)/);
        if (rlsAssertionMatch) {
          current.rlsIsolationAssertionId = rlsAssertionMatch[1].trim();
          continue;
        }
        const evidenceMatch = line.match(/^\s+[a-zA-Z0-9_]+\s*:\s*["']?([^"'#]+?)["']?\s*$/);
        const candidate = evidenceMatch?.[1]?.trim();
        if (candidate && /\.(?:ts|tsx|js|mjs|sql|json|md)$/.test(candidate)) {
          current.evidencePaths.push(candidate);
        }
      }
    }

    if (inSecurityClaims) flush();
    return claims;
  } catch {
    return [];
  }
}

function readDeclaredActiveSecurityClaimIds(rootPath: string): string[] {
  return readDeclaredActiveSecurityClaims(rootPath).map(claim => claim.id);
}

function normalizeRlsRecord(value: unknown): RlsExecutionRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const string = (key: string): string | undefined => typeof record[key] === 'string' && record[key].length <= 160
    ? record[key] : undefined;
  const scenario = string('scenario');
  const status = string('status');
  const runtime = string('runtime');
  const claimId = string('claim_id');
  const nonce = string('nonce');
  const resource = string('resource');
  const targetHash = string('target_sha256');
  if (record.version !== 1 || !claimId || !nonce || !resource || !targetHash
    || !['PRETEST_RLS_CONFIGURATION', 'ALLOW_SAME_TENANT', 'DENY_CROSS_TENANT'].includes(scenario || '')
    || !['PASS', 'FAIL'].includes(status || '') || runtime !== 'POSTGRES') return null;
  const operations = Array.isArray(record.operations) && record.operations.every(item =>
    typeof item === 'string' && ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(item))
    ? Array.from(new Set(record.operations)) as Array<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'>
    : undefined;
  const boolean = (key: string): boolean | undefined => typeof record[key] === 'boolean' ? record[key] : undefined;
  const hash = (key: string): string | undefined => {
    const candidate = string(key);
    return candidate && /^[a-f0-9]{64}$/.test(candidate) ? candidate : undefined;
  };
  return {
    version: 1, claim_id: claimId, nonce, scenario: scenario as RlsExecutionRecord['scenario'],
    status: status as RlsExecutionRecord['status'], runtime: 'POSTGRES', resource, target_sha256: targetHash,
    rls_enabled: boolean('rls_enabled'), rls_forced: boolean('rls_forced'),
    policy_count: Number.isSafeInteger(record.policy_count) ? record.policy_count as number : undefined,
    role_is_owner: boolean('role_is_owner'), role_has_bypassrls: boolean('role_has_bypassrls'),
    security_definer_bypass: boolean('security_definer_bypass'),
    actor_identity_sha256: hash('actor_identity_sha256'), actor_tenant_sha256: hash('actor_tenant_sha256'),
    resource_tenant_sha256: hash('resource_tenant_sha256'), operations,
  };
}

function extractRlsRecords(output: string): RlsExecutionRecord[] {
  const records: RlsExecutionRecord[] = [];
  for (const line of output.split(/\r?\n/)) {
    const marker = 'EOS_RLS_RECORD ';
    const index = line.indexOf(marker);
    if (index < 0) continue;
    try {
      const record = normalizeRlsRecord(JSON.parse(line.slice(index + marker.length)));
      if (record) records.push(record);
    } catch { /* registro inválido não constitui evidência */ }
  }
  return records;
}

interface ProjectCheckOptions {
  readonly rlsClaim?: { readonly id: string; readonly nonce: string };
}

function findNestedPackageManifests(rootPath: string): string[] {
  const fs = require('fs');
  const results: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 3) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'release'].includes(entry.name)) continue;
      const child = path.join(dir, entry.name);
      const manifest = path.join(child, 'package.json');
      if (fs.existsSync(manifest)) results.push(manifest);
      walk(child, depth + 1);
    }
  };
  walk(rootPath, 0);
  return results;
}

export class AuditApplicationService {
  private async executeProjectCheck(
    rootPath: string,
    check: string,
    workingDirectory: string = rootPath,
    options: ProjectCheckOptions = {},
  ): Promise<ExecutionEvidence> {
    const childProcess = require('child_process');
    const startedAt = Date.now();
    const isWindows = process.platform === 'win32';
    const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd', 'run', check] : ['run', check];
    const relativeWorkingDir = path.relative(rootPath, workingDirectory).replace(/\\/g, '/');
    const commandLine = relativeWorkingDir
      ? `npm --prefix ${relativeWorkingDir} run ${check}`
      : `npm run ${check}`;
    const declaredTimeouts = readDeclaredExecutionTimeoutConfig(rootPath);
    const timeoutMs = parseExecutionTimeout(process.env.EOS_CHECK_TIMEOUT_MS)
      ?? declaredTimeouts.checkTimeoutsMs[check]
      ?? declaredTimeouts.defaultTimeoutMs
      ?? 120_000;
    const heartbeatMs = Math.max(250, Number(process.env.EOS_CHECK_HEARTBEAT_MS || 15000));
    const maxCapturedBytes = 10 * 1024 * 1024;

    console.log(`[EOS][CHECK] ▶ ${commandLine}`);

    return await new Promise<ExecutionEvidence>((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;
      let spawnError: Error | null = null;

      const appendBounded = (current: string, chunk: unknown): string => {
        const next = current + String(chunk ?? '');
        if (Buffer.byteLength(next, 'utf8') <= maxCapturedBytes) return next;
        return next.slice(-maxCapturedBytes);
      };

      const child = childProcess.spawn(command, args, {
        cwd: workingDirectory,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: options.rlsClaim ? {
          ...process.env,
          EOS_RLS_CLAIM_ID: options.rlsClaim.id,
          EOS_RLS_NONCE: options.rlsClaim.nonce,
          EOS_RLS_PHASE: 'BASELINE',
        } : undefined,
      });

      child.stdout?.on('data', (chunk: unknown) => {
        stdout = appendBounded(stdout, chunk);
      });
      child.stderr?.on('data', (chunk: unknown) => {
        stderr = appendBounded(stderr, chunk);
      });

      const heartbeat = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        console.log(`[EOS][CHECK] … ${commandLine} em execução — ${elapsedSeconds}s`);
      }, heartbeatMs);

      const terminateTree = async (): Promise<void> => {
        const terminationGraceMs = 5_000;
        const forcedCloseGraceMs = 1_000;
        await new Promise<void>((resolveTermination) => {
          let finished = false;
          let killer: any = null;
          let graceTimer: ReturnType<typeof setTimeout> | null = null;
          let forcedCloseTimer: ReturnType<typeof setTimeout> | null = null;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (graceTimer) clearTimeout(graceTimer);
            if (forcedCloseTimer) clearTimeout(forcedCloseTimer);
            resolveTermination();
          };

          child.once('close', finish);
          try {
            if (isWindows && child.pid) {
              killer = childProcess.spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
              });
              killer.once('error', () => {
                try { child.kill(); } catch { /* best effort */ }
              });
            } else {
              child.kill('SIGTERM');
            }
          } catch {
            try { child.kill(); } catch { /* processo já encerrado */ }
          }

          graceTimer = setTimeout(() => {
            try { killer?.kill(); } catch { /* best effort */ }
            try { child.kill('SIGKILL'); } catch {
              try { child.kill(); } catch { /* best effort */ }
            }
            forcedCloseTimer = setTimeout(finish, forcedCloseGraceMs);
          }, terminationGraceMs);
        });
      };

      const timeout = setTimeout(() => {
        timedOut = true;
        stderr = appendBounded(stderr, `\nTempo limite excedido após ${timeoutMs} ms.`);
        console.error(`[EOS][CHECK] ✗ ${commandLine} TIMEOUT — ${Math.floor(timeoutMs / 1000)}s`);
        void terminateTree().finally(() => finalize(null));
      }, timeoutMs);

      const finalize = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearInterval(heartbeat);
        clearTimeout(timeout);

        if (spawnError) {
          stderr = appendBounded(stderr, `\n${spawnError.message}`);
        }

        const exitCode = timedOut || spawnError ? -1 : (typeof code === 'number' ? code : -1);
        const state = exitCode === 0 ? 'PASS' : 'FAIL';
        const durationMs = Date.now() - startedAt;
        const output = redactOutput(`${stdout}\n${stderr}`).replace(/\s+/g, ' ').trim();
        const symbol = state === 'PASS' ? '✓' : '✗';
        console.log(`[EOS][CHECK] ${symbol} ${commandLine} ${state} — ${(durationMs / 1000).toFixed(1)}s`);

        resolve({
          check_id: `EOS-EXEC-${check.toUpperCase()}`,
          command_line: commandLine,
          working_directory: workingDirectory,
          exit_code: exitCode,
          state,
          duration_ms: durationMs,
          stdout_sha256: crypto.createHash('sha256').update(stdout).digest('hex'),
          stderr_sha256: crypto.createHash('sha256').update(stderr).digest('hex'),
          output_excerpt: output.slice(0, 500) || '(sem saída)',
          ...(options.rlsClaim ? {
            rls_claim_id: options.rlsClaim.id,
            rls_nonce: options.rlsClaim.nonce,
            rls_records: extractRlsRecords(`${stdout}\n${stderr}`),
          } : {}),
        });
      };

      child.once('error', (error: Error) => {
        spawnError = error;
        finalize(null);
      });
      child.once('close', (code: number | null) => finalize(code));
    });
  }

  private async executeProjectChecks(rootPath: string): Promise<ExecutionEvidence[]> {
    const packagePath = path.join(rootPath, 'package.json');
    if (!require('fs').existsSync(packagePath)) {
      return [{
        check_id: 'EOS-EXEC-001', command_line: 'package.json', working_directory: rootPath,
        exit_code: -1, state: 'NOT_AVAILABLE', duration_ms: 0,
        stdout_sha256: '', stderr_sha256: '',
        output_excerpt: 'Nenhum package.json foi encontrado; validações de runtime não puderam ser determinadas.'
      }];
    }

    let scripts: Record<string, string> = {};
    try { scripts = JSON.parse(require('fs').readFileSync(packagePath, 'utf8')).scripts || {}; } catch {
      return [{
        check_id: 'EOS-EXEC-001', command_line: 'package.json', working_directory: rootPath,
        exit_code: -1, state: 'NOT_AVAILABLE', duration_ms: 0,
        stdout_sha256: '', stderr_sha256: '', output_excerpt: 'package.json inválido; scripts não puderam ser determinados.'
      }];
    }

    const productionCheck = readDeclaredProductionValidationScript(rootPath);
    const declaredSecurityClaims = readDeclaredActiveSecurityClaims(rootPath);
    const rlsClaims = declaredSecurityClaims.filter(claim => claim.claimType === 'RLS');
    const preferredTest = typeof scripts['test:all'] === 'string' ? 'test:all' : 'test';
    const checks = ['typecheck', 'lint', preferredTest, 'build']
      .filter((name, index, list) => list.indexOf(name) === index)
      .filter(name => typeof scripts[name] === 'string');

    if (productionCheck && typeof scripts[productionCheck] === 'string' && !checks.includes(productionCheck)) {
      checks.push(productionCheck);
    }
    for (const claim of declaredSecurityClaims) {
      if (claim.claimType !== 'RLS' && claim.validationScript && typeof scripts[claim.validationScript] === 'string' && !checks.includes(claim.validationScript)) {
        checks.push(claim.validationScript);
      }
    }

    const results: ExecutionEvidence[] = [];
    for (const check of checks) {
      results.push(await this.executeProjectCheck(rootPath, check));
    }

    // Claims RLS recebem nonce novo; registros de execução de uma rodada anterior
    // não podem ser reaproveitados para conceder GREEN.
    for (const claim of rlsClaims) {
      if (claim.validationScript && typeof scripts[claim.validationScript] === 'string') {
        results.push(await this.executeProjectCheck(rootPath, claim.validationScript, rootPath, {
          rlsClaim: { id: claim.id, nonce: crypto.randomUUID() },
        }));
      }
    }

    for (const manifestPath of findNestedPackageManifests(rootPath)) {
      let nestedScripts: Record<string, string> = {};
      try {
        nestedScripts = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8')).scripts || {};
      } catch {
        results.push({
          check_id: 'EOS-EXEC-NESTED-MANIFEST',
          command_line: path.relative(rootPath, manifestPath).replace(/\\/g, '/'),
          working_directory: path.dirname(manifestPath),
          exit_code: -1,
          state: 'NOT_AVAILABLE',
          duration_ms: 0,
          stdout_sha256: '',
          stderr_sha256: '',
          output_excerpt: 'Manifesto aninhado inválido; os gates desse módulo não puderam ser determinados.'
        });
        continue;
      }
      if (typeof nestedScripts.test === 'string') {
        results.push(await this.executeProjectCheck(rootPath, 'test', path.dirname(manifestPath)));
      }
    }

    if (productionCheck && typeof scripts[productionCheck] !== 'string') {
      results.push({
        check_id: 'EOS-EXEC-PRODUCTION',
        command_line: `npm run ${productionCheck}`,
        working_directory: rootPath,
        exit_code: -1,
        state: 'NOT_AVAILABLE',
        duration_ms: 0,
        stdout_sha256: '',
        stderr_sha256: '',
        output_excerpt: `O perfil de produção exige o script '${productionCheck}', mas ele não existe no package.json.`
      });
    }

    for (const claim of declaredSecurityClaims) {
      if (!claim.validationScript || typeof scripts[claim.validationScript] !== 'string') {
        const expected = claim.validationScript || '(não declarado)';
        results.push({
          check_id: `EOS-EXEC-SECURITY-${claim.id}`,
          command_line: claim.validationScript ? `npm run ${claim.validationScript}` : `security-claim:${claim.id}`,
          working_directory: rootPath,
          exit_code: -1,
          state: 'NOT_AVAILABLE',
          duration_ms: 0,
          stdout_sha256: '',
          stderr_sha256: '',
          output_excerpt: `Claim ACTIVE ${claim.id} exige validation_script executável; recebido: ${expected}.`
        });
      }
    }

    if (results.length === 0) {
      return [{
        check_id: 'EOS-EXEC-001', command_line: 'npm scripts', working_directory: rootPath,
        exit_code: -1, state: 'NOT_AVAILABLE', duration_ms: 0,
        stdout_sha256: '', stderr_sha256: '',
        output_excerpt: 'Não foram encontrados scripts executáveis de typecheck, lint, test/test:all, build ou testes em manifests aninhados.'
      }];
    }

    return results;
  }

  public async executeAudit(targetPath: string, outputDir: string = '.eos'): Promise<AuditReport> {
    // 0. Verificação de Integridade do Próprio Governador EOS (INVARIANT-11)
    const governorVerifier = new GovernorIntegrityVerifier();
    const eosCorePath = path.resolve(__dirname, '..');
    const governorIntegrity = governorVerifier.verifyGovernorIntegrity(eosCorePath);

// 1. Resolver Target
    const target = TargetResolver.resolve(targetPath);

    // Diretório de domínio declarado pelo projeto (eos.risk.yml), default 'src/domain'
    const declaredDomainDir = readDeclaredDomainDirectory(target.root_path);
    const declaredActiveSecurityClaims = readDeclaredActiveSecurityClaims(target.root_path);
    const declaredActiveSecurityClaimIds = declaredActiveSecurityClaims.map(claim => claim.id);

    // Executa primeiro as validações declaradas pelo projeto. A coleta estática
    // posterior representa o estado observado após os comandos terminarem.
    const executionEvidences = await this.executeProjectChecks(target.root_path);

    // 2. Coletar do Filesystem Real
    const fsCollector = new FilesystemCollector();
    const fsCollectionResult = await fsCollector.collect(target);

    // 3. Coletar AST TypeScript Real
    const astCollector = new TypescriptAstCollector();
    const astEvidences = await astCollector.collectFromArtifacts(target, fsCollectionResult.artifacts);

    // Evidências agregadas
    // 3.5 Coletar Manifestos de Projeto e TsConfig
    const manifestCollector = new ProjectManifestCollector();
    const manifestResult = manifestCollector.collect(target);

    // Evidências agregadas
    const allEvidences: Evidence[] = [
      ...fsCollectionResult.evidences,
      ...astEvidences,
      manifestResult.manifestEvidence,
    ];

    // 4. Provedores de Fatos Semânticos
    const fsFactProvider = new FileStructureFactProvider();
    const fsFacts = fsFactProvider.generateFacts(fsCollectionResult.evidences, declaredDomainDir);

    const depFactProvider = new DependencyFactProvider(manifestResult.evidenceContext);
    const depFacts = depFactProvider.generateFacts(allEvidences);

    const allFacts: Fact[] = [...fsFacts, ...depFacts];

    // 5. Avaliação de Regras Arquiteturais
    const ruleResults: RuleEvaluationResult[] = [];
    const findings: Finding[] = [];

    // Rule 1: Estrutura de Diretórios Obrigatória
    const mandatoryDirRule = new MandatoryDirectoryRule(declaredDomainDir);
    const res1 = mandatoryDirRule.evaluate(fsFacts, target);
    ruleResults.push(res1.evaluation);
    if (res1.finding) findings.push(res1.finding);

    // Rule 2: Dependências Proibidas de Módulos (Domain -> Infra)
    const noDisallowedDepRule = new NoDisallowedDependencyRule(declaredDomainDir);
    const res2 = noDisallowedDepRule.evaluate(depFacts, target);
    ruleResults.push(res2.evaluation);
    if (res2.findings && res2.findings.length > 0) {
      findings.push(...res2.findings);
    }

    const coverageComplete = fsCollectionResult.coverage.files_errored === 0
      && fsCollectionResult.coverage.files_inaccessible === 0;
    ruleResults.push({
      rule_id: 'EOS-COVERAGE-001', rule_version: '1.0',
      status: coverageComplete ? 'PASS' : 'INSUFFICIENT_EVIDENCE',
      rationale: coverageComplete
        ? 'A coleta não registrou arquivos inacessíveis ou erros de leitura.'
        : `A coleta registrou ${fsCollectionResult.coverage.files_errored} erro(s) e ${fsCollectionResult.coverage.files_inaccessible} arquivo(s) inacessível(is); o escopo não está completamente comprovado.`,
      facts_used: []
    });
    const unavailableChecks = executionEvidences.filter(check => check.state === 'NOT_AVAILABLE');
    const failedChecks = executionEvidences.filter(check => check.state === 'FAIL');
    ruleResults.push({
      rule_id: 'EOS-EXECUTION-001', rule_version: '1.0',
      status: failedChecks.length > 0 ? 'FAIL' : unavailableChecks.length > 0 ? 'INSUFFICIENT_EVIDENCE' : 'PASS',
      rationale: failedChecks.length > 0
        ? `Validações executadas com falha: ${failedChecks.map(check => check.command_line).join(', ')}.`
        : unavailableChecks.length > 0
          ? unavailableChecks[0].output_excerpt
          : `Validações executadas e aprovadas: ${executionEvidences.map(check => check.command_line).join(', ')}.`,
      facts_used: []
    });

    const productionScript = readDeclaredProductionValidationScript(target.root_path);
    if (productionScript) {
      const productionCommand = `npm run ${productionScript}`;
      const productionEvidence = executionEvidences.find(check => check.command_line === productionCommand);
      const productionStatus = !productionEvidence || productionEvidence.state === 'NOT_AVAILABLE'
        ? 'INSUFFICIENT_EVIDENCE'
        : productionEvidence.state === 'PASS' ? 'PASS' : 'FAIL';
      ruleResults.push({
        rule_id: 'EOS-PRODUCTION-001', rule_version: '1.0',
        status: productionStatus,
        rationale: productionEvidence
          ? `Validação de produção '${productionCommand}': ${productionEvidence.state}. ${productionEvidence.output_excerpt}`
          : `O perfil de produção declarou '${productionScript}', mas nenhuma evidência de execução foi produzida.`,
        facts_used: []
      });
    }

    // 6. Execução via Domain Adapters Universais (Decoupled Architecture)
    const envelopes: EvidenceEnvelope[] = [];
    const firestoreAdapter = new FirestoreDomainAdapter();
    const discoveredArtifacts = await firestoreAdapter.discoverArtifacts(target.root_path);
    if (discoveredArtifacts.length > 0) {
      const claims = await firestoreAdapter.buildClaims(discoveredArtifacts);
      for (const claim of claims) {
        const envelope = await firestoreAdapter.executeCapture(claim, target.root_path);
        envelopes.push(envelope);

        if (envelope.blocking_reasons.length > 0) {
          envelope.blocking_reasons.forEach((reason, idx) => {
            findings.push({
              finding_id: `EOS-DOM-${envelope.claimId}-${idx + 1}`,
              rule_id: 'SEC-GOV-UNIVERSAL-001',
              rule_version: '4.1',
              fact_ids: [],
              evidence_ids: [envelope.envelopeId],
              target_id: target.target_id,
              location: envelope.targetArtifact,
              title: `Bloqueio de Governança [${envelope.state}]`,
              description: reason,
              severity: 'CRITICAL',
              confidence: 1.0,
              status: 'OPEN',
              timestamp: new Date().toISOString()
            });
          });
        }
      }
    }

    // Avaliação de claims de segurança declarados + suporte legado Firestore.
    const firestoreSecEngine = new FirestoreSecurityEngine();
    const securityClaims = firestoreSecEngine.evaluateRules(target.root_path);
    const formalEvidences: FormalEvidence[] = [];
    const declaredEvaluations: SecurityClaimEvaluation[] = [];
    const declaredCausalityEngine = new DeclaredClaimCausalityEngine();
    const rlsClaimEngine = new RlsClaimEngine();

    const inferClaimType = (claimId: string, declaredType: string): SecurityClaimEvaluation['claim_type'] => {
      if (declaredType === 'RLS') return 'RLS';
      if (claimId.includes('AUTH')) return 'AUTHENTICATION';
      if (claimId.includes('RBAC') || claimId.includes('AUTHZ')) return 'AUTHORIZATION';
      return 'DATA_MUTABILITY';
    };

    for (const declared of declaredActiveSecurityClaims) {
      if (securityClaims.some(claim => claim.claim_id === declared.id)) continue;

      const blockingReasons: string[] = [];
      const targetArtifact = declared.target || 'eos.risk.yml';
      if (!declared.target || !require('fs').existsSync(path.join(target.root_path, declared.target))) {
        blockingReasons.push(`Artefato-alvo do claim ${declared.id} não foi encontrado: ${targetArtifact}.`);
      }

      const missingEvidencePaths = declared.evidencePaths.filter(
        evidencePath => !require('fs').existsSync(path.join(target.root_path, evidencePath))
      );
      if (missingEvidencePaths.length > 0) {
        blockingReasons.push(
          `Evidências declaradas ausentes para ${declared.id}: ${missingEvidencePaths.join(', ')}.`
        );
      }

      const validationCommand = declared.validationScript
        ? `npm run ${declared.validationScript}`
        : null;
      const validationEvidence = validationCommand
        ? executionEvidences.find(item => item.command_line === validationCommand
          && (declared.claimType !== 'RLS' || item.rls_claim_id === declared.id))
        : undefined;

      if (!declared.validationScript) {
        blockingReasons.push(`Claim ${declared.id} não declara evidence.validation_script.`);
      } else if (!validationEvidence || validationEvidence.state !== 'PASS') {
        blockingReasons.push(
          `Validação executável do claim ${declared.id} não passou: ${validationCommand}.`
        );
      }

      const rlsAssessment = declared.claimType === 'RLS'
        ? rlsClaimEngine.evaluate({
            rootPath: target.root_path,
            claimId: declared.id,
            targetArtifact,
            resource: declared.rlsResource,
            isolationAssertionId: declared.rlsIsolationAssertionId,
            causalSpecPath: declared.causalSpecPath,
            executionEvidence: validationEvidence,
          })
        : undefined;
      if (rlsAssessment) blockingReasons.push(...rlsAssessment.blockingReasons);

      const declaredMutation =
        blockingReasons.length === 0 && declared.validationScript && declared.causalSpecPath
          ? declaredCausalityEngine.evaluateCausality(
              target.root_path,
              declared.id,
              targetArtifact,
              declared.validationScript,
              declared.causalSpecPath,
            )
          : undefined;
      const causalProven = declaredMutation?.causality_proven === true;

      const evidenceSeed = [
        declared.id,
        targetArtifact,
        declared.validationScript || '',
        ...declared.evidencePaths,
        validationEvidence?.stdout_sha256 || '',
        validationEvidence?.stderr_sha256 || '',
        declared.causalSpecPath || '',
        declaredMutation?.mutation_id || '',
        String(declaredMutation?.causality_proven ?? false),
      ].join('|');
      const formalEvidence: FormalEvidence = {
        evidence_id: `EVD-DECL-${crypto.createHash('sha256').update(evidenceSeed).digest('hex').slice(0, 16)}`,
        category: causalProven
          ? 'CAUSAL'
          : declared.validationScript?.includes('postgres') || declared.validationScript?.includes('e2e')
            ? 'RUNTIME'
            : 'INTEGRATION',
        source_artifact: targetArtifact,
        test_artifact: declared.validationScript
          ? `npm run ${declared.validationScript}`
          : declared.evidencePaths[0],
        runtime_environment: declared.validationScript?.includes('postgres')
          ? 'DB_RUNTIME'
          : declared.validationScript?.includes('e2e')
            ? 'HTTP_RUNTIME'
            : 'NONE',
        causality_status: causalProven
          ? 'PROVEN_CAUSAL'
          : declaredMutation
            ? 'CAUSALITY_FAILED'
            : 'CORRELATED',
        confidence_score: causalProven ? 1.0 : blockingReasons.length === 0 ? 0.9 : 0.4,
        source_reliability: causalProven ? 1.0 : blockingReasons.length === 0 ? 0.9 : 0.5,
        reproducible: Boolean(validationEvidence?.state === 'PASS'),
        is_simulation_only: false,
        payload: {
          declared_validation: true,
          claim_id: declared.id,
          validation_script: declared.validationScript,
          evidence_paths: declared.evidencePaths,
          execution_state: validationEvidence?.state || 'NOT_AVAILABLE',
          execution_stdout_sha256: validationEvidence?.stdout_sha256 || null,
          execution_stderr_sha256: validationEvidence?.stderr_sha256 || null,
          execution_output_excerpt: validationEvidence?.output_excerpt || null,
          execution_exit_code: validationEvidence?.exit_code ?? null,
          execution_duration_ms: validationEvidence?.duration_ms ?? null,
          rls_records: validationEvidence?.rls_records || null,
          causal_spec: declared.causalSpecPath,
          mutation_id: declaredMutation?.mutation_id || null,
          mutation_original_status: declaredMutation?.original_status || null,
          mutation_status: declaredMutation?.mutated_status || null,
        }
      };

      const evaluation: SecurityClaimEvaluation = {
        claim_id: declared.id,
        claim_type: inferClaimType(declared.id, declared.claimType),
        target_artifact: targetArtifact,
        evidence: formalEvidence,
        threat_vectors: rlsAssessment?.threatVectors || [],
        mutation_result: declaredMutation,
        proven: causalProven,
        phase_status: blockingReasons.length > 0 ? 'BLOCKED' : causalProven ? 'GREEN' : 'YELLOW',
        blocking_reasons: [
          ...blockingReasons,
          ...(declaredMutation && !causalProven ? [declaredMutation.rationale] : []),
        ],
      };
      securityClaims.push(evaluation);
      declaredEvaluations.push(evaluation);
      formalEvidences.push(formalEvidence);
    }

    const evaluatedClaimIds = new Set<string>([
      ...securityClaims.map(claim => claim.claim_id),
      ...envelopes.map(envelope => envelope.claimId),
    ]);
    const missingDeclaredClaims = declaredActiveSecurityClaimIds.filter(id => !evaluatedClaimIds.has(id));
    const blockedDeclaredClaims = declaredEvaluations.filter(claim => claim.phase_status === 'BLOCKED');
    const provenDeclaredClaims = declaredEvaluations.filter(claim => claim.proven);
    ruleResults.push({
      rule_id: 'EOS-SECURITY-CLAIMS-001',
      rule_version: '1.1',
      status: missingDeclaredClaims.length > 0
        ? 'INSUFFICIENT_EVIDENCE'
        : blockedDeclaredClaims.length > 0
          ? 'FAIL'
          : 'PASS',
      rationale: missingDeclaredClaims.length > 0
        ? `Claims de segurança ACTIVE sem avaliação formal: ${missingDeclaredClaims.join(', ')}.`
        : blockedDeclaredClaims.length > 0
          ? `Claims ACTIVE com evidência inválida/ausente: ${blockedDeclaredClaims.map(claim => claim.claim_id).join(', ')}.`
          : declaredActiveSecurityClaimIds.length > 0
            ? `Todos os ${declaredActiveSecurityClaimIds.length} claim(s) ACTIVE foram materializados; ${provenDeclaredClaims.length} causalmente PROVEN e ${declaredActiveSecurityClaimIds.length - provenDeclaredClaims.length} ainda sem prova causal.`
            : 'Nenhum claim de segurança ACTIVE foi declarado em eos.risk.yml.',
      facts_used: []
    });

    const causalityEngine = new CausalityMutationEngine();
    for (let i = 0; i < securityClaims.length; i++) {
      const claim = securityClaims[i];
      if (claim.evidence.payload?.declared_validation === true) continue;

      const mutationRes = causalityEngine.evaluateCausality(target.root_path, claim.evidence);
      let updatedClaim = claim;
      if (!mutationRes.causality_proven) {
        const blocking = [...claim.blocking_reasons, mutationRes.rationale];
        updatedClaim = {
          ...claim,
          mutation_result: mutationRes,
          proven: false,
          phase_status: 'BLOCKED',
          blocking_reasons: blocking
        };
        securityClaims[i] = updatedClaim;
      }
      formalEvidences.push(claim.evidence);
    }

    // Revisão estática de riscos recorrentes em apps gerados por IA. A ausência
    // de prova causal de RLS em uma integração de dados permanece inconclusiva.
    const generatedAppSecurity = new GeneratedAppSecurityEngine().scan(
      target.root_path,
      target.target_id,
      declaredEvaluations.some(claim => claim.claim_type === 'RLS' && claim.proven),
    );
    findings.push(...generatedAppSecurity.findings);
    ruleResults.push(generatedAppSecurity.rule);

    // 7. Avaliação de Hard Quality Gates Invioláveis (Fail-Closed)
    const hardGateEngine = new HardQualityGateEngine();
    const hardGateRes = hardGateEngine.evaluateHardGates(
      securityClaims,
      envelopes,
      governorIntegrity.isValid,
      100
    );

    // 8. Montar Relatório Final Verificável
    const runIdSeed = `${target.target_id}:${fsCollectionResult.coverage.files_analyzed}:${allFacts.length}:${new Date().toISOString()}`;
    const auditRunId = `RUN-${crypto.createHash('sha256').update(runIdSeed).digest('hex').slice(0, 12)}`;

    const report: AuditReport = {
      audit_run_id: auditRunId,
      timestamp: new Date().toISOString(),
      target,
      coverage: fsCollectionResult.coverage,
      findings,
      rule_results: ruleResults,
      facts: allFacts,
      evidences: allEvidences,
      formal_evidences: formalEvidences,
      execution_evidences: executionEvidences,
      security_claims: securityClaims,
      overall_phase_status: hardGateRes.overall_phase_status === 'BLOCKED'
        ? 'BLOCKED'
        : ruleResults.some(result => result.status === 'FAIL')
          ? 'RED'
          : ruleResults.some(result => result.status === 'INSUFFICIENT_EVIDENCE' || result.status === 'ERROR')
            ? 'BLOCKED'
            : hardGateRes.overall_phase_status
    };

    // Assinar Relatório com HMAC SHA-256 (INVARIANT-09 / Report Integrity)
    const reportSignature = ReportIntegritySigner.signReportContent(report);
    (report as any).integrity_signature = reportSignature;

    // 9. Persistir Artefatos
    JsonReporter.writeReport(report, outputDir);
    MarkdownReporter.writeReport(report, outputDir);

    return report;
  }
}

