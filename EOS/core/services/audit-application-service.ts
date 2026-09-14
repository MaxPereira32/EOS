import * as crypto from 'crypto';
import * as path from 'path';
import { TargetResolver } from '../domain/target-resolver';
import { FilesystemCollector } from '../collectors/filesystem-collector';
import { TypescriptAstCollector } from '../collectors/typescript-ast-collector';
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

export class AuditApplicationService {
  private executeProjectChecks(rootPath: string): ExecutionEvidence[] {
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

    const checks = ['typecheck', 'lint', 'test', 'build'].filter(name => typeof scripts[name] === 'string');
    if (checks.length === 0) {
      return [{
        check_id: 'EOS-EXEC-001', command_line: 'npm scripts', working_directory: rootPath,
        exit_code: -1, state: 'NOT_AVAILABLE', duration_ms: 0,
        stdout_sha256: '', stderr_sha256: '', output_excerpt: 'Não foram encontrados scripts typecheck, lint, test ou build para execução.'
      }];
    }

    const childProcess = require('child_process');
    return checks.map(check => {
      const startedAt = Date.now();
      const isWindows = process.platform === 'win32';
      const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
      const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd', 'run', check] : ['run', check];
      const result = childProcess.spawnSync(command, args, {
        // npm.cmd é executado pelo interpretador do Windows sem shell implícito.
        // Os argumentos são controlados pelo EOS e a lista de checks é fechada.
        cwd: rootPath, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024,
        shell: false
      });
      const stdout = result.stdout || '';
      const stderr = `${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}`;
      const output = `${stdout}\n${stderr}`.replace(/\s+/g, ' ').trim();
      return {
        check_id: `EOS-EXEC-${check.toUpperCase()}`,
        command_line: `npm run ${check}`,
        working_directory: rootPath,
        exit_code: result.status === 0 ? 0 : (result.status ?? -1),
        state: result.status === 0 ? 'PASS' : 'FAIL',
        duration_ms: Date.now() - startedAt,
        stdout_sha256: crypto.createHash('sha256').update(stdout).digest('hex'),
        stderr_sha256: crypto.createHash('sha256').update(stderr).digest('hex'),
        output_excerpt: output.slice(0, 500) || '(sem saída)'
      };
    });
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
    const executionEvidences = this.executeProjectChecks(target.root_path);

    // 2. Coletar do Filesystem Real
    const fsCollector = new FilesystemCollector();
    const fsCollectionResult = await fsCollector.collect(target);

    // 3. Coletar AST TypeScript Real
    const astCollector = new TypescriptAstCollector();
    const astEvidences = await astCollector.collectFromArtifacts(target, fsCollectionResult.artifacts);

    // Evidências agregadas
    const allEvidences: Evidence[] = [...fsCollectionResult.evidences, ...astEvidences];

    // 4. Provedores de Fatos Semânticos
    const fsFactProvider = new FileStructureFactProvider();
    const fsFacts = fsFactProvider.generateFacts(fsCollectionResult.evidences, declaredDomainDir);

    const depFactProvider = new DependencyFactProvider();
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
    const noDisallowedDepRule = new NoDisallowedDependencyRule();
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

