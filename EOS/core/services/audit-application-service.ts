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
import { AuditReport, Finding, RuleEvaluationResult, Evidence, Fact, FormalEvidence, SecurityClaimEvaluation, ExecutionEvidence } from '../domain/types';
import { FirestoreSecurityEngine } from '../engines/firestore-security-engine';
import { CausalityMutationEngine } from '../engines/causality-mutation-engine';
import { HardQualityGateEngine } from '../engines/hard-quality-gate-engine';
import { GovernorIntegrityVerifier } from '../utils/governor-integrity-verifier';
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

export class AuditApplicationService {
  private async executeProjectCheck(rootPath: string, check: string): Promise<ExecutionEvidence> {
    const childProcess = require('child_process');
    const startedAt = Date.now();
    const isWindows = process.platform === 'win32';
    const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd', 'run', check] : ['run', check];
    const commandLine = `npm run ${check}`;
    const timeoutMs = Number(process.env.EOS_CHECK_TIMEOUT_MS || 120000);
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
        cwd: rootPath,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
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

      const terminateTree = () => {
        try {
          if (isWindows && child.pid) {
            childProcess.spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
              windowsHide: true,
              stdio: 'ignore',
            });
          } else {
            child.kill('SIGTERM');
          }
        } catch {
          try { child.kill(); } catch { /* processo já encerrado */ }
        }
      };

      const timeout = setTimeout(() => {
        timedOut = true;
        stderr = appendBounded(stderr, `\nTempo limite excedido após ${timeoutMs} ms.`);
        console.error(`[EOS][CHECK] ✗ ${commandLine} TIMEOUT — ${Math.floor(timeoutMs / 1000)}s`);
        terminateTree();
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
        const output = `${stdout}\n${stderr}`.replace(/\s+/g, ' ').trim();
        const symbol = state === 'PASS' ? '✓' : '✗';
        console.log(`[EOS][CHECK] ${symbol} ${commandLine} ${state} — ${(durationMs / 1000).toFixed(1)}s`);

        resolve({
          check_id: `EOS-EXEC-${check.toUpperCase()}`,
          command_line: commandLine,
          working_directory: rootPath,
          exit_code: exitCode,
          state,
          duration_ms: durationMs,
          stdout_sha256: crypto.createHash('sha256').update(stdout).digest('hex'),
          stderr_sha256: crypto.createHash('sha256').update(stderr).digest('hex'),
          output_excerpt: output.slice(0, 500) || '(sem saída)'
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
    const checks = ['typecheck', 'lint', 'test', 'build'].filter(name => typeof scripts[name] === 'string');
    if (productionCheck && typeof scripts[productionCheck] === 'string' && !checks.includes(productionCheck)) {
      checks.push(productionCheck);
    }
    if (checks.length === 0 && !productionCheck) {
      return [{
        check_id: 'EOS-EXEC-001', command_line: 'npm scripts', working_directory: rootPath,
        exit_code: -1, state: 'NOT_AVAILABLE', duration_ms: 0,
        stdout_sha256: '', stderr_sha256: '', output_excerpt: 'Não foram encontrados scripts typecheck, lint, test ou build para execução.'
      }];
    }

    const results: ExecutionEvidence[] = [];
    for (const check of checks) {
      results.push(await this.executeProjectCheck(rootPath, check));
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

    // Avaliação Legada de Suporte
    const firestoreSecEngine = new FirestoreSecurityEngine();
    const securityClaims = firestoreSecEngine.evaluateRules(target.root_path);
    const causalityEngine = new CausalityMutationEngine();
    const formalEvidences: FormalEvidence[] = [];

    for (let i = 0; i < securityClaims.length; i++) {
      const claim = securityClaims[i];
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

