import * as crypto from 'crypto';
import * as path from 'path';
import { FilesystemTargetResolver } from '../adapters/filesystem-target-resolver';

import { FilesystemCollector } from '../collectors/filesystem-collector';
import { TypescriptAstCollector } from '../collectors/typescript-ast-collector';
import { FileStructureFactProvider } from '../fact-providers/file-structure-fact-provider';
import { DependencyFactProvider } from '../fact-providers/dependency-fact-provider';
import { MandatoryDirectoryRule } from '../rules/mandatory-directory-rule';
import { NoDisallowedDependencyRule } from '../rules/no-disallowed-dependency-rule';
import { JsonReporter } from '../reporters/json-reporter';
import { MarkdownReporter } from '../reporters/markdown-reporter';
import { AuditReport, Finding, RuleEvaluationResult, Evidence, Fact, FormalEvidence, SecurityClaimEvaluation } from '../domain/types';
import { FirestoreSecurityEngine } from '../engines/firestore-security-engine';
import { CausalityMutationEngine } from '../engines/causality-mutation-engine';
import { HardQualityGateEngine } from '../engines/hard-quality-gate-engine';
import { GovernorIntegrityVerifier } from '../utils/governor-integrity-verifier';
import { ReportIntegritySigner } from '../utils/report-integrity-signer';
import { FirestoreDomainAdapter } from '../adapters/firestore/firestore-domain-adapter';
import { EvidenceEnvelope } from '../domain/universal-contracts';

export class AuditApplicationService {
  public async executeAudit(targetPath: string, outputDir: string = '.eos'): Promise<AuditReport> {
    // 0. Verificação de Integridade do Próprio Governador EOS (INVARIANT-11)
    const governorVerifier = new GovernorIntegrityVerifier();
    const eosCorePath = path.resolve(__dirname, '..');
    const governorIntegrity = governorVerifier.verifyGovernorIntegrity(eosCorePath);

    // 1. Resolver Target
    const targetResolver = new FilesystemTargetResolver();
    const target = targetResolver.resolve(targetPath);

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
    const fsFacts = fsFactProvider.generateFacts(fsCollectionResult.evidences, 'src/domain');

    const depFactProvider = new DependencyFactProvider();
    const depFacts = depFactProvider.generateFacts(allEvidences);

    const allFacts: Fact[] = [...fsFacts, ...depFacts];

    // 5. Avaliação de Regras Arquiteturais
    const ruleResults: RuleEvaluationResult[] = [];
    const findings: Finding[] = [];

    // Rule 1: Estrutura de Diretórios Obrigatória
    const mandatoryDirRule = new MandatoryDirectoryRule();
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
      security_claims: securityClaims,
      overall_phase_status: hardGateRes.overall_phase_status
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

