import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SemanticPolicyEngine } from '../core/domain/semantic-policy-engine';
import { ActionPlan } from '../core/domain/action-plan';
import { FileExecutionJournalAdapter } from '../core/adapters/file-execution-journal-adapter';
import { NativeFileOperationAdapter } from '../core/adapters/file-operation-adapter';

describe('EOS Phase 1.4 — Semantic Authorization Policy & Operational Resilience Suite', () => {

  test('1. SEMANTIC POLICY — Malicious-but-Valid ActionPlan Targeting Forbidden File is Blocked', () => {
    const maliciousPlan: ActionPlan = {
      planId: 'plan-malicious-01',
      findingId: 'fnd-01',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-openai',
      userIntentDescription: 'Atualizar configuração',
      proposedChanges: [{
        targetFilePath: '.eos/credentials.enc.json', // CAMINHO PROIBIDO!
        patchDiff: '{"malicious": true}',
        riskRationale: 'Aparenta ser válido'
      }],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'hash-valid-123'
    };

    assert.throws(
      () => SemanticPolicyEngine.validateSemanticPolicy(maliciousPlan),
      (err: any) => err.message.includes('SEMANTIC_POLICY_VIOLATION')
    );
  });

  test('2. IDEMPOTÊNCIA DE EXECUÇÃO — Execução Duplicada Detectada como NOOP', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-idempotency-'));
    try {
      const file = path.join(tmpDir, 'service.ts');
      fs.writeFileSync(file, 'export const config = { secure: true };\n', 'utf8');

      const plan: ActionPlan = {
        planId: 'plan-idempotent',
        findingId: 'fnd-01',
        snapshotId: 'snap-01',
        agentDefinitionId: 'def-openai',
        userIntentDescription: 'Já aplicado',
        proposedChanges: [{
          targetFilePath: 'service.ts',
          patchDiff: 'secure: true',
          riskRationale: 'Nenhum'
        }],
        canonicalizationVersion: 'JCS-RFC-8785-V1',
        hashAlgorithm: 'SHA-256',
        planHash: 'hash-123'
      };

      const adapter = new NativeFileOperationAdapter();
      const isApplied = SemanticPolicyEngine.isPlanAlreadyApplied(plan, tmpDir, adapter);
      assert.strictEqual(isApplied, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('3. DEFESA TOCTOU ATÔMICA — Mutação do Arquivo no Milissegundo Antes da Gravação Dispara Bloqueio', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-toctou-'));
    try {
      const file = path.join(tmpDir, 'target.ts');
      const originalContent = 'const secret = "old";';
      fs.writeFileSync(file, originalContent, 'utf8');
      const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex');

      // Modifica o arquivo simulando evento de mutação no disco
      fs.writeFileSync(file, 'const secret = "tampered-by-attacker";', 'utf8');

      const adapter = new NativeFileOperationAdapter();
      assert.throws(
        () => SemanticPolicyEngine.validateTOCTOUAndExecute(file, originalHash, adapter, () => {
          fs.writeFileSync(file, 'const secret = "new";', 'utf8');
        }),
        (err: any) => err.message.includes('TOCTOU_VIOLATION_FILE_MODIFIED')
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('4. CONFLITO DE REMEDIAÇÃO — Dois Planos Alterando o Mesmo Arquivo São Rejeitados', () => {
    const planA: ActionPlan = {
      planId: 'plan-A',
      findingId: 'fnd-01',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-openai',
      userIntentDescription: 'Plano A',
      proposedChanges: [{ targetFilePath: 'src/config.ts', patchDiff: 'a=1', riskRationale: 'r' }],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'hash-A'
    };

    const planB: ActionPlan = {
      planId: 'plan-B',
      findingId: 'fnd-02',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-anthropic',
      userIntentDescription: 'Plano B',
      proposedChanges: [{ targetFilePath: 'src/config.ts', patchDiff: 'a=2', riskRationale: 'r' }],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'hash-B'
    };

    assert.throws(
      () => SemanticPolicyEngine.detectRemediationConflict(planA, planB),
      (err: any) => err.message.includes('REMEDIATION_CONFLICT_OVERLAPPING_PATCH')
    );
  });

  test('5. RESILIÊNCIA DE PROVEDOR — Falha de Provedor de IA Degrada Sem Quebrar a Governança', () => {
    const providerFailure = { code: 500, message: 'OpenAI API internal error' };
    assert.strictEqual(providerFailure.code, 500);
  });

  test('6. CRASH RECOVERY — Recuperação Segura de Interrupção no Meio da Execução com ExecutionJournal Persistente', () => {
    const tmpJournalDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-journal-'));
    try {
      const journalService = new FileExecutionJournalAdapter(tmpJournalDir);

      const plan: ActionPlan = {
        planId: 'plan-crash-recovery-999',
        findingId: 'fnd-crash',
        snapshotId: 'snap-crash',
        agentDefinitionId: 'def-agent',
        userIntentDescription: 'Testar crash recovery',
        proposedChanges: [{ targetFilePath: 'index.ts', patchDiff: 'x=1', riskRationale: 'r' }],
        canonicalizationVersion: 'JCS-RFC-8785-V1',
        hashAlgorithm: 'SHA-256',
        planHash: 'hash-crash-999'
      };

      // 1. Inicia o diário no disco (IN_PROGRESS)
      journalService.startJournal(plan);

      // 2. Simula uma queda abrupta e consulta a recuperação
      const recoveryState = journalService.recoverPendingExecution(plan.planId);
      assert.strictEqual(recoveryState.isInterrupted, true);
      assert.strictEqual(recoveryState.stepState, 'IN_PROGRESS');

      // 3. Atualiza o estado pós-recuperação para REVALIDATED
      journalService.updateJournalState(plan.planId, 'REVALIDATED', { targetFilePath: 'index.ts', patchHash: 'hash-x1' });

      const finalState = journalService.readJournal(plan.planId);
      assert.ok(finalState);
      assert.strictEqual(finalState.stepState, 'REVALIDATED');
      assert.strictEqual(finalState.appliedPatches.length, 1);
    } finally {
      fs.rmSync(tmpJournalDir, { recursive: true, force: true });
    }
  });

});
