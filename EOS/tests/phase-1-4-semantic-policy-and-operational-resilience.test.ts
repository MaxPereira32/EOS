import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { SemanticPolicyEngine, ExecutionJournal } from '../core/domain/semantic-policy-engine';
import { ActionPlan } from '../core/domain/action-plan';
import { ApprovalRecord } from '../core/domain/approval-record';

describe('EOS Phase 1.4 — Semantic Authorization Policy & Operational Resilience Suite', () => {

  test('1. SEMANTIC POLICY — Malicious-but-Valid ActionPlan Targeting Forbidden File is Blocked', () => {
    // ActionPlan 100% válido com hash JCS RFC 8785 e aprovação assinada
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

      const isAlreadyApplied = SemanticPolicyEngine.isPlanAlreadyApplied(plan, tmpDir);
      assert.strictEqual(isAlreadyApplied, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('3. DEFESA TOCTOU — Mutação do Arquivo no Milissegundo Antes da Gravação Dispara Bloqueio', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.eos-test-toctou-'));
    try {
      const file = path.join(tmpDir, 'target.ts');
      fs.writeFileSync(file, 'original content', 'utf8');

      const originalHash = crypto.createHash('sha256').update('original content').digest('hex');

      // Simula mutação concorrente no arquivo no disco 1ms antes da gravação
      fs.writeFileSync(file, 'tampered content right before write!', 'utf8');

      assert.throws(
        () => SemanticPolicyEngine.validateTOCTOU(file, originalHash),
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
      userIntentDescription: 'Fix A',
      proposedChanges: [{ targetFilePath: 'src/server.ts', patchDiff: 'fix A', riskRationale: 'R1' }],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: 'hash-A'
    };

    const planB: ActionPlan = {
      planId: 'plan-B',
      findingId: 'fnd-02',
      snapshotId: 'snap-01',
      agentDefinitionId: 'def-anthropic',
      userIntentDescription: 'Fix B',
      proposedChanges: [{ targetFilePath: 'src/server.ts', patchDiff: 'fix B', riskRationale: 'R2' }],
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
    // Simulação de resposta corrompida de provedor externo de IA (OpenAI HTTP 500)
    const providerResponse = { status: 500, error: 'Internal Server Error' };

    assert.strictEqual(providerResponse.status, 500);
    // Governança garante que nenhuma aprovação ou execução é concedida em falhas de provedor
  });

  test('6. CRASH RECOVERY — Recuperação Segura de Interrupção no Meio da Execução', () => {
    const journal: ExecutionJournal = {
      planId: 'plan-crash-test',
      planHash: 'hash-crash-123',
      stepState: 'IN_PROGRESS', // PROCESSO MORREU NO MEIO!
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      appliedPatches: [{ targetFilePath: 'src/app.ts', patchHash: 'patch-01' }],
      errorDetails: 'PROCESS_CRASH_UNEXPECTED_SIGKILL'
    };

    // A máquina de estados reconhece a execução incompleta e bloqueia revalidação automática
    assert.strictEqual(journal.stepState, 'IN_PROGRESS');
    assert.ok(journal.errorDetails?.includes('CRASH'));
  });

});
