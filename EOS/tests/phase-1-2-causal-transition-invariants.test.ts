import { test, describe } from 'node:test';
import * as assert from 'assert';
import { 
  CausalTransitionValidators, 
  SourceSnapshot 
} from '../core/domain/causal-pipeline-contracts';
import { Finding } from '../core/domain/types';
import { ActionPlan } from '../core/domain/action-plan';
import { ApprovalRecord } from '../core/domain/approval-record';

describe('EOS Phase 1.2 — Causal Transition Invariants & Lineage Protection Suite', () => {

  test('1. INVARIANT 1 — Finding sem Evidências Concretas é Rejeitado', () => {
    const invalidFinding: Finding = {
      finding_id: 'fnd-01',
      rule_id: 'SEC-RULE-01',
      rule_version: '1.0',
      fact_ids: ['fct-01'],
      evidence_ids: [], // VAZIO!
      target_id: 'tgt-01',
      location: 'src/index.ts',
      title: 'Vulnerabilidade de Teste',
      description: 'Sem evidência de origem',
      severity: 'HIGH',
      confidence: 0.9,
      status: 'OPEN',
      timestamp: new Date().toISOString()
    };

    assert.throws(
      () => CausalTransitionValidators.validateFindingHasEvidence(invalidFinding),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_1')
    );
  });

  test('2. INVARIANT 2 — ActionPlan sem Finding Vinculado é Rejeitado', () => {
    const finding: Finding = {
      finding_id: 'fnd-01',
      rule_id: 'SEC-RULE-01',
      rule_version: '1.0',
      fact_ids: ['fct-01'],
      evidence_ids: ['ev-01'],
      target_id: 'tgt-01',
      location: 'src/index.ts',
      title: 'Vulnerabilidade Válida',
      description: 'Descrição',
      severity: 'HIGH',
      confidence: 0.9,
      status: 'OPEN',
      timestamp: new Date().toISOString()
    };

    const invalidPlan: ActionPlan = {
      planId: 'plan-01',
      findingId: 'fnd-OUTRO-ID', // DIVERGENTE!
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-openai',
      userIntentDescription: 'Corrigir falha',
      proposedChanges: [],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'plan-hash-123'
    };

    assert.throws(
      () => CausalTransitionValidators.validateActionPlanHasFinding(invalidPlan, finding),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_2')
    );
  });

  test('3. INVARIANT 3 — Execução sem ApprovalRecord Assinado é Bloqueada', () => {
    const plan: ActionPlan = {
      planId: 'plan-01',
      findingId: 'fnd-01',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-openai',
      userIntentDescription: 'Corrigir falha',
      proposedChanges: [],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'plan-hash-123'
    };

    const rejectedApproval: ApprovalRecord = {
      approvalId: 'app-01',
      planId: 'plan-01',
      approvedPlanHash: 'plan-hash-123',
      approvedBy: 'security-admin@eos.local',
      approvedAt: new Date().toISOString(),
      decision: 'REJECTED', // REJEITADO!
      signature: 'sig-hmac-sha256-rejected'
    };

    assert.throws(
      () => CausalTransitionValidators.validateExecutionApproval(plan, rejectedApproval),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_3_DECISION')
    );
  });

  test('4. INVARIANT 4 — Aprovação com Hash Divergente Invalida a Execução', () => {
    const plan: ActionPlan = {
      planId: 'plan-01',
      findingId: 'fnd-01',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-openai',
      userIntentDescription: 'Corrigir falha',
      proposedChanges: [],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'plan-hash-MODIFICADO-456' // PLANO ATUAL FOI ALTERADO!
    };

    const approvalForOldPlan: ApprovalRecord = {
      approvalId: 'app-01',
      planId: 'plan-01',
      approvedPlanHash: 'plan-hash-ORIGINAL-123', // PLANO ANTERIOR APROVADO!
      approvedBy: 'security-admin@eos.local',
      approvedAt: new Date().toISOString(),
      decision: 'APPROVED',
      signature: 'sig-hmac-sha256-approved'
    };

    assert.throws(
      () => CausalTransitionValidators.validateExecutionApproval(plan, approvalForOldPlan),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_4')
    );
  });

  test('5. INVARIANT 5 — Alteração na Árvore de Arquivos Pós-Aprovação Exige Revalidação', () => {
    const snapshotAtProposal: SourceSnapshot = {
      snapshotId: 'snap-01',
      repositoryRoot: process.cwd(),
      commitHash: 'commit-abc',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-BEFORE-123'
    };

    const currentSnapshotModified: SourceSnapshot = {
      snapshotId: 'snap-02',
      repositoryRoot: process.cwd(),
      commitHash: 'commit-def',
      branchName: 'main',
      observedAt: new Date().toISOString(),
      treeHash: 'tree-hash-AFTER-MODIFIED-789' // ESTADO DO DISCO MUDOU!
    };

    assert.throws(
      () => CausalTransitionValidators.validateStateFreshness(snapshotAtProposal, currentSnapshotModified),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_5')
    );
  });

  test('6. INVARIANT 6 — Revalidação Rejeita Reutilização do AuditRun Anterior (Stale AuditRun)', () => {
    const previousRunId = 'RUN-audit-initial-7788';
    const staleRevalidationRunId = 'RUN-audit-initial-7788'; // REUTILIZADO CEGAMENTE!

    assert.throws(
      () => CausalTransitionValidators.validateRevalidationFreshness(previousRunId, staleRevalidationRunId),
      (err: any) => err.message.includes('CAUSAL_INVARIANT_VIOLATION_6')
    );
  });

});
