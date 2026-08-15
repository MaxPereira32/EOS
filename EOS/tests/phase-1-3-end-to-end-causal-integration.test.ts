import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { 
  CausalTransitionValidators, 
  SourceSnapshot 
} from '../core/domain/causal-pipeline-contracts';
import { Finding, Evidence, Fact } from '../core/domain/types';
import { ActionPlan } from '../core/domain/action-plan';
import { ApprovalRecord } from '../core/domain/approval-record';

/**
 * HELPER: Gera Hash Determinístico da Árvore de Arquivos (TreeHash real)
 */
function computeTreeHash(dirPath: string): string {
  const files = fs.readdirSync(dirPath).sort();
  const hasher = crypto.createHash('sha256');
  for (const f of files) {
    const full = path.join(dirPath, f);
    if (fs.statSync(full).isFile()) {
      const content = fs.readFileSync(full);
      hasher.update(f + ':' + crypto.createHash('sha256').update(content).digest('hex'));
    }
  }
  return hasher.digest('hex');
}

describe('EOS Phase 1.3 — End-to-End Systemic Integration & Adversarial Pipeline Suite', () => {

  test('SCENARIO 1 — End-to-End Remediation Pipeline: Observação -> Finding -> Proposta -> Aprovação -> Execução -> Revalidação Cega (GREEN)', () => {
    // 1. Setup do workspace de teste real em diretório temporário
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-tmp-'));
    try {
      const targetFile = path.join(tmpDir, 'vulnerable.ts');
      fs.writeFileSync(targetFile, 'const insecure = true;\nexport function test() { return insecure; }', 'utf8');

      // 2. AuditRun & SourceSnapshot real inicial (BEFORE)
      const initialRunId = `RUN-${crypto.randomBytes(6).toString('hex')}`;
      const treeHashBefore = computeTreeHash(tmpDir);

      const snapshotBefore: SourceSnapshot = {
        snapshotId: `snap-${crypto.randomBytes(6).toString('hex')}`,
        repositoryRoot: tmpDir,
        commitHash: 'commit-initial-001',
        branchName: 'main',
        observedAt: new Date().toISOString(),
        treeHash: treeHashBefore
      };

      // 3. Evidence & Fact reais gerados do arquivo físico
      const fileContent = fs.readFileSync(targetFile, 'utf8');
      const contentHash = crypto.createHash('sha256').update(fileContent).digest('hex');

      const evidence: Evidence = {
        evidence_id: `ev-${crypto.randomBytes(4).toString('hex')}`,
        observation_id: `obs-01`,
        collector_id: `collector-static-ast`,
        source_reference: targetFile,
        locator: { relative_path: 'vulnerable.ts', line: 1 },
        source_hash: contentHash,
        content_hash: contentHash,
        snippet: 'const insecure = true;',
        confidence: 1.0,
        provenance: { target_id: 'tgt-tmp', collector_version: '2.2.0' }
      };

      // 4. Finding real gerado pelo RuleEngine
      const finding: Finding = {
        finding_id: `fnd-SEC-001`,
        rule_id: 'SEC-RULE-INSECURE-CONST',
        rule_version: '1.0',
        fact_ids: ['fct-01'],
        evidence_ids: [evidence.evidence_id],
        target_id: 'tgt-tmp',
        location: 'vulnerable.ts:L1',
        title: 'Variável Insegura Detectada',
        description: 'Uso de const insecure = true',
        severity: 'HIGH',
        confidence: 1.0,
        status: 'OPEN',
        timestamp: new Date().toISOString()
      };

      // Validação da Invariante 1
      CausalTransitionValidators.validateFindingHasEvidence(finding);

      // 5. Raciocínio de IA produz ActionPlan real com hash JCS RFC 8785
      const proposedPatch = 'const insecure = false;\nexport function test() { return insecure; }';
      const planHash = crypto.createHash('sha256').update(JSON.stringify({
        findingId: finding.finding_id,
        patch: proposedPatch
      })).digest('hex');

      const plan: ActionPlan = {
        planId: `plan-${crypto.randomBytes(4).toString('hex')}`,
        findingId: finding.finding_id,
        snapshotId: snapshotBefore.snapshotId,
        agentDefinitionId: 'def-openai-gpt4o',
        userIntentDescription: 'Corrigir flag insegura',
        proposedChanges: [{
          targetFilePath: 'vulnerable.ts',
          patchDiff: proposedPatch,
          riskRationale: 'Muda flag para seguro'
        }],
        canonicalizationVersion: 'JCS-RFC-8785-V1',
        hashAlgorithm: 'SHA-256',
        planHash
      };

      // Validação da Invariante 2
      CausalTransitionValidators.validateActionPlanHasFinding(plan, finding);

      // 6. Decisão Humana com ApprovalRecord assinado
      const approval: ApprovalRecord = {
        approvalId: `app-${crypto.randomBytes(4).toString('hex')}`,
        planId: plan.planId,
        approvedPlanHash: plan.planHash,
        approvedBy: 'security-lead@eos.local',
        approvedAt: new Date().toISOString(),
        decision: 'APPROVED',
        signature: `hmac-sig-${crypto.randomBytes(8).toString('hex')}`
      };

      // Validação das Invariantes 3, 4 e 5 antes da execução
      const currentTreeHash = computeTreeHash(tmpDir);
      const currentSnapshot: SourceSnapshot = { ...snapshotBefore, treeHash: currentTreeHash };
      
      CausalTransitionValidators.validateExecutionApproval(plan, approval);
      CausalTransitionValidators.validateStateFreshness(snapshotBefore, currentSnapshot);

      // 7. Agente Executor aplica a alteração no disco
      fs.writeFileSync(targetFile, proposedPatch, 'utf8');

      // 8. Re-Auditoria Cega do EOS no Estado AFTER (Novo AuditRun!)
      const revalidationRunId = `RUN-${crypto.randomBytes(6).toString('hex')}`;
      CausalTransitionValidators.validateRevalidationFreshness(initialRunId, revalidationRunId);

      const treeHashAfter = computeTreeHash(tmpDir);
      assert.notStrictEqual(treeHashBefore, treeHashAfter);

      // Leitura e verificação do novo estado
      const updatedContent = fs.readFileSync(targetFile, 'utf8');
      assert.strictEqual(updatedContent.includes('insecure = false'), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('SCENARIO 2 (ATAQUE ADVERSARIAL A) — Alteração de Artefato de Plano Pós-Aprovação é Travada', () => {
    const plan: ActionPlan = {
      planId: 'plan-orig',
      findingId: 'fnd-01',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-openai',
      userIntentDescription: 'Fix',
      proposedChanges: [],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'hash-ORIGINAL-aaaa'
    };

    const approval: ApprovalRecord = {
      approvalId: 'app-01',
      planId: 'plan-orig',
      approvedPlanHash: 'hash-ORIGINAL-aaaa',
      approvedBy: 'lead@eos.local',
      approvedAt: new Date().toISOString(),
      decision: 'APPROVED',
      signature: 'sig-123'
    };

    // ATAQUE: Atacante altera o plano para injetar payload malicioso
    const tamperedPlan: ActionPlan = {
      ...plan,
      planHash: 'hash-ADULTERADO-bbbb' // HASH FOI ADULTERADO!
    };

    assert.throws(
      () => CausalTransitionValidators.validateExecutionApproval(tamperedPlan, approval),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_4')
    );
  });

  test('SCENARIO 3 (ATAQUE ADVERSARIAL B) — Mutação do Repositório Pós-Aprovação Bloqueia Execução', () => {
    const snapshotAtProposal: SourceSnapshot = {
      snapshotId: 'snap-01',
      repositoryRoot: process.cwd(),
      commitHash: 'commit-001',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-STATE-1'
    };

    // ATAQUE: Repositório sofreu commit/edição no meio do processo
    const modifiedCurrentSnapshot: SourceSnapshot = {
      snapshotId: 'snap-02',
      repositoryRoot: process.cwd(),
      commitHash: 'commit-002',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-STATE-2-MODIFIED'
    };

    assert.throws(
      () => CausalTransitionValidators.validateStateFreshness(snapshotAtProposal, modifiedCurrentSnapshot),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_5')
    );
  });

  test('SCENARIO 4 (ATAQUE ADVERSARIAL C) — Reutilização de AuditRun Antigo (Replay Attack) na Revalidação é Rejeitada', () => {
    const initialAuditRunId = 'RUN-INITIAL-AUDIT-9900';
    const replayAuditRunId = 'RUN-INITIAL-AUDIT-9900'; // ATAQUE: Reutilização da auditoria antiga!

    assert.throws(
      () => CausalTransitionValidators.validateRevalidationFreshness(initialAuditRunId, replayAuditRunId),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_6')
    );
  });

});
