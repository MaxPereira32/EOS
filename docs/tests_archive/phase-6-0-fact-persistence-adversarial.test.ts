import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Fact, FACT_SCHEMA_VERSION_1_0, Evidence } from '../EOS/core/domain/types';
import { FactIntegrityError, FactOverwriteForbiddenError } from '../EOS/core/domain/fact-repository';
import { InMemoryFactRepository } from '../EOS/core/storage/in-memory-fact-repository';

async function runPhase60AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 6.0 — FACT PERSISTENCE & HISTORICAL VERSIONING');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  const target = TargetResolver.resolve('.');

  function createValidFact(overrides?: Partial<Fact>): Fact {
    const defaultPayload = {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    const semHash = crypto.createHash('sha256').update(JSON.stringify(defaultPayload)).digest('hex');
    const inpHash = crypto.createHash('sha256').update('evidence_input_1').digest('hex');

    return {
      fact_id: `FCT-60-${crypto.createHash('md5').update(`${semHash}:${inpHash}`).digest('hex').slice(0, 12)}`,
      schema_version: FACT_SCHEMA_VERSION_1_0,
      fact_type: 'MODULE_DEPENDENCY',
      provider_id: 'dependency-fact-provider',
      provider_version: '6.0.0',
      evidence_ids: ['EVD-60-01'],
      input_hash: inpHash,
      semantic_hash: semHash,
      lifecycle_status: 'VALID',
      payload: defaultPayload,
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  // --- PERSISTENCE ---

  await test('FACT-6.0-001 — Salvar Fact válido', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    assert.doesNotThrow(() => repo.save(fact));
  });

  await test('FACT-6.0-002 — Recuperar Fact pelo fact_id', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    repo.save(fact);
    const retrieved = repo.getById(fact.fact_id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.fact_id, fact.fact_id);
  });

  await test('FACT-6.0-003 — Fact recuperado mantém semantic_hash intacto', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    repo.save(fact);
    const retrieved = repo.getById(fact.fact_id);
    assert.strictEqual(retrieved?.semantic_hash, fact.semantic_hash);
  });

  await test('FACT-6.0-004 — Fact recuperado mantém input_hash intacto', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    repo.save(fact);
    const retrieved = repo.getById(fact.fact_id);
    assert.strictEqual(retrieved?.input_hash, fact.input_hash);
  });

  await test('FACT-6.0-005 — Fact recuperado mantém evidence_ids intactos', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    repo.save(fact);
    const retrieved = repo.getById(fact.fact_id);
    assert.deepStrictEqual(retrieved?.evidence_ids, fact.evidence_ids);
  });

  // --- IMMUTABILITY & NO-OVERWRITE ---

  await test('FACT-6.0-006 — Segundo save do mesmo Fact é idempotente', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    repo.save(fact);
    assert.doesNotThrow(() => repo.save(fact));
    assert.strictEqual(repo.getAll().length, 1);
  });

  await test('FACT-6.0-007 — Mesmo fact_id com conteúdo diferente é rejeitado (FactOverwriteForbiddenError)', () => {
    const repo = new InMemoryFactRepository();
    const factA = createValidFact();
    repo.save(factA);

    const factTampered = {
      ...factA,
      composite_confidence: 0.5, // Alterado
    };

    assert.throws(() => repo.save(factTampered), FactOverwriteForbiddenError);
  });

  await test('FACT-6.0-008 — Alteração de payload não pode substituir Fact existente', () => {
    const repo = new InMemoryFactRepository();
    const factA = createValidFact();
    repo.save(factA);

    const factPayloadTampered = {
      ...factA,
      payload: { ...factA.payload, target_module: 'src/domain/Hacked.ts' },
    };

    assert.throws(() => repo.save(factPayloadTampered), FactOverwriteForbiddenError);
  });

  await test('FACT-6.0-009 — Alteração manual de lifecycle não pode sobrescrever histórico silenciosamente', () => {
    const repo = new InMemoryFactRepository();
    const factA = createValidFact();
    repo.save(factA);

    const factStatusTampered = {
      ...factA,
      lifecycle_status: 'SUPERSEDED' as const,
    };

    assert.throws(() => repo.save(factStatusTampered), FactOverwriteForbiddenError);
  });

  // --- HISTORY & SUPERSEDING ---

  await test('FACT-6.0-010 — Dois Facts semanticamente iguais e fisicamente diferentes coexistem', () => {
    const repo = new InMemoryFactRepository();

    const semHash = crypto.createHash('sha256').update('same_semantics').digest('hex');
    const inpHash1 = crypto.createHash('sha256').update('physical_v1').digest('hex');
    const inpHash2 = crypto.createHash('sha256').update('physical_v2').digest('hex');

    const fact1 = createValidFact({
      fact_id: 'FCT-HIST-01',
      semantic_hash: semHash,
      input_hash: inpHash1,
    });

    const fact2 = createValidFact({
      fact_id: 'FCT-HIST-02',
      semantic_hash: semHash,
      input_hash: inpHash2,
    });

    repo.save(fact1);
    repo.save(fact2);

    assert.strictEqual(repo.getAll().length, 2);
  });

  await test('FACT-6.0-011 — findBySemanticHash() retorna todas as versões do histórico', () => {
    const repo = new InMemoryFactRepository();
    const semHash = crypto.createHash('sha256').update('same_semantics_history').digest('hex');

    const fact1 = createValidFact({
      fact_id: 'FCT-HIST-11',
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_1').digest('hex'),
    });

    const fact2 = createValidFact({
      fact_id: 'FCT-HIST-12',
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_2').digest('hex'),
    });

    repo.save(fact1);
    repo.save(fact2);

    const history = repo.findHistoryBySemanticHash(semHash);
    assert.strictEqual(history.length, 2);
  });

  await test('FACT-6.0-012 — findByInputHash() retorna somente a instância correspondente', () => {
    const repo = new InMemoryFactRepository();
    const inpHashA = crypto.createHash('sha256').update('inp_A').digest('hex');
    const inpHashB = crypto.createHash('sha256').update('inp_B').digest('hex');

    const factA = createValidFact({ fact_id: 'FCT-INP-A', input_hash: inpHashA });
    const factB = createValidFact({ fact_id: 'FCT-INP-B', input_hash: inpHashB });

    repo.save(factA);
    repo.save(factB);

    const resA = repo.findByInputHash(inpHashA);
    assert.strictEqual(resA.length, 1);
    assert.strictEqual(resA[0].fact_id, 'FCT-INP-A');
  });

  await test('FACT-6.0-013 — Histórico permanece ordenável deterministicamente', () => {
    const repo = new InMemoryFactRepository();
    const semHash = crypto.createHash('sha256').update('det_order').digest('hex');

    const f1 = createValidFact({ fact_id: 'FCT-ORD-1', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('h1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-ORD-2', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('h2').digest('hex') });
    const f3 = createValidFact({ fact_id: 'FCT-ORD-3', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('h3').digest('hex') });

    repo.save(f1);
    repo.save(f2);
    repo.save(f3);

    const history = repo.findHistoryBySemanticHash(semHash);
    assert.strictEqual(history[0].fact_id, 'FCT-ORD-1');
    assert.strictEqual(history[1].fact_id, 'FCT-ORD-2');
    assert.strictEqual(history[2].fact_id, 'FCT-ORD-3');
  });

  await test('FACT-6.0-014 — Novo input gera nova instância no repositório', () => {
    const repo = new InMemoryFactRepository();
    const f1 = createValidFact({ fact_id: 'FCT-NEW-1', input_hash: crypto.createHash('sha256').update('inp1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-NEW-2', input_hash: crypto.createHash('sha256').update('inp2').digest('hex') });

    repo.save(f1);
    repo.save(f2);

    assert.notStrictEqual(f1.fact_id, f2.fact_id);
    assert.strictEqual(repo.getAll().length, 2);
  });

  await test('FACT-6.0-015 — Mesmo semantic_hash + novo input não elimina Fact antigo', () => {
    const repo = new InMemoryFactRepository();
    const semHash = crypto.createHash('sha256').update('sem_coexist').digest('hex');

    const fOld = createValidFact({ fact_id: 'FCT-OLD-15', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('inp_old').digest('hex') });
    const fNew = createValidFact({ fact_id: 'FCT-NEW-15', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('inp_new').digest('hex') });

    repo.save(fOld);
    repo.save(fNew);

    assert.ok(repo.getById('FCT-OLD-15') !== null, 'Fact antigo deve continuar no repositório');
  });

  await test('FACT-6.0-016 — Fact antigo continua recuperável com status SUPERSEDED', () => {
    const repo = new InMemoryFactRepository();
    const semHash = crypto.createHash('sha256').update('sem_supersede_check').digest('hex');

    const fOld = createValidFact({ fact_id: 'FCT-OLD-16', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('inp_old_16').digest('hex') });
    const fNew = createValidFact({ fact_id: 'FCT-NEW-16', semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('inp_new_16').digest('hex') });

    repo.save(fOld);
    repo.save(fNew);

    const oldRetrieved = repo.getById('FCT-OLD-16');
    const newRetrieved = repo.getById('FCT-NEW-16');

    assert.strictEqual(oldRetrieved?.lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(newRetrieved?.lifecycle_status, 'VALID');
    assert.strictEqual(repo.findValidBySemanticHash(semHash)?.fact_id, 'FCT-NEW-16');
  });

  await test('FACT-6.0-017 — Superseding não altera payload nem evidências do Fact antigo', () => {
    const repo = new InMemoryFactRepository();
    const semHash = crypto.createHash('sha256').update('sem_payload_intact').digest('hex');

    const fOld = createValidFact({
      fact_id: 'FCT-OLD-17',
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_old_17').digest('hex'),
      evidence_ids: ['EVD-ORIGINAL-17'],
    });

    const fNew = createValidFact({
      fact_id: 'FCT-NEW-17',
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_new_17').digest('hex'),
      evidence_ids: ['EVD-NEW-17'],
    });

    repo.save(fOld);
    repo.save(fNew);

    const oldRetrieved = repo.getById('FCT-OLD-17')!;
    assert.strictEqual(oldRetrieved.evidence_ids[0], 'EVD-ORIGINAL-17');
    if (oldRetrieved.payload.fact_type === 'MODULE_DEPENDENCY' && fOld.payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.strictEqual(oldRetrieved.payload.source_module, fOld.payload.source_module);
    }
  });

  // --- INTEGRIDADE ---

  await test('FACT-6.0-018 — Fact sem evidência é rejeitado (FactIntegrityError)', () => {
    const repo = new InMemoryFactRepository();
    const invalidFact = createValidFact({ evidence_ids: [] });
    assert.throws(() => repo.save(invalidFact), FactIntegrityError);
  });

  await test('FACT-6.0-019 — Fact com hash inválido é rejeitado (FactIntegrityError)', () => {
    const repo = new InMemoryFactRepository();
    const badInputHash = createValidFact({ input_hash: 'not_a_sha256_hash' });
    const badSemanticHash = createValidFact({ semantic_hash: '123' });

    assert.throws(() => repo.save(badInputHash), FactIntegrityError);
    assert.throws(() => repo.save(badSemanticHash), FactIntegrityError);
  });

  await test('FACT-6.0-020 — Schema incompatível é rejeitado (FactIntegrityError)', () => {
    const repo = new InMemoryFactRepository();
    const badSchema = createValidFact({ schema_version: '2.0' });
    assert.throws(() => repo.save(badSchema), FactIntegrityError);
  });

  // --- ISOLAMENTO & REGRAS ---

  await test('FACT-6.0-021 — Repository não invade Rules (Rules funcionam sem repositório)', () => {
    const rule = new NoDisallowedDependencyRule();
    const fact = createValidFact();
    const evalRes = rule.evaluate([fact], target);
    assert.ok(evalRes);
    assert.strictEqual(evalRes.evaluation.rule_id, NoDisallowedDependencyRule.ruleId);
  });

  await test('FACT-6.0-022 — Rules não acessam repository (Análise estática sem referência a storage)', () => {
    const rulePath = path.resolve(__dirname, '../EOS/core/rules/no-disallowed-dependency-rule.ts');
    const source = fs.readFileSync(rulePath, 'utf-8');
    assert.strictEqual(source.includes('FactRepository'), false);
    assert.strictEqual(source.includes('InMemoryFactRepository'), false);
    assert.strictEqual(source.includes('storage'), false);
  });

  // --- DETERMINISMO & CONCORRÊNCIA ---

  await test('FACT-6.0-023 — Mesma sequência de Facts produz mesmo resultado histórico (determinismo)', () => {
    const repo1 = new InMemoryFactRepository();
    const repo2 = new InMemoryFactRepository();

    const f1 = createValidFact({ fact_id: 'FCT-SEQ-1', input_hash: crypto.createHash('sha256').update('1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-SEQ-2', input_hash: crypto.createHash('sha256').update('2').digest('hex') });

    repo1.save(f1);
    repo1.save(f2);

    repo2.save(f1);
    repo2.save(f2);

    assert.deepStrictEqual(
      repo1.getAll().map((f) => f.fact_id),
      repo2.getAll().map((f) => f.fact_id)
    );
  });

  await test('FACT-6.0-024 — Reexecução independente produz histórico equivalente', () => {
    const semHash = crypto.createHash('sha256').update('indep_history').digest('hex');

    const run1Repo = new InMemoryFactRepository();
    const run2Repo = new InMemoryFactRepository();

    const f = createValidFact({ semantic_hash: semHash });

    run1Repo.save(f);
    run2Repo.save(f);

    const f1 = run1Repo.findValidBySemanticHash(semHash);
    const f2 = run2Repo.findValidBySemanticHash(semHash);

    assert.strictEqual(f1?.semantic_hash, f2?.semantic_hash);
    assert.strictEqual(f1?.input_hash, f2?.input_hash);
  });

  await test('FACT-6.0-025 — Tampering test: Tentativas de mutação no objeto Fact não afetam o repositório', () => {
    const repo = new InMemoryFactRepository();
    const fact = createValidFact();
    repo.save(fact);

    // Tentativa de mutação via objeto original
    try {
      (fact as any).lifecycle_status = 'SUPERSEDED';
    } catch {
      // Object.freeze bloqueou mutação no objeto original
    }

    const retrieved = repo.getById(fact.fact_id)!;
    assert.strictEqual(retrieved.lifecycle_status, 'VALID');

    // Tentativa de mutação no objeto recuperado
    assert.throws(() => {
      (retrieved as any).semantic_hash = 'hacked_hash';
    }, TypeError);
  });

  await test('FACT-6.0-026 — Concorrência lógica: save(A) -> save(A) -> save(B) -> save(A_tampered)', () => {
    const repo = new InMemoryFactRepository();
    const factA = createValidFact({ fact_id: 'FCT-LOGIC-A' });
    const factB = createValidFact({ fact_id: 'FCT-LOGIC-B', semantic_hash: crypto.createHash('sha256').update('other').digest('hex') });

    // 1. save(A) -> Aceito
    assert.doesNotThrow(() => repo.save(factA));

    // 2. save(A) -> Idempotente
    assert.doesNotThrow(() => repo.save(factA));

    // 3. save(B) -> Aceito
    assert.doesNotThrow(() => repo.save(factB));

    // 4. save(A_adulterado) -> REJECT
    const factATampered = { ...factA, composite_confidence: 0.1 };
    assert.throws(() => repo.save(factATampered), FactOverwriteForbiddenError);

    assert.strictEqual(repo.getAll().length, 2);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 6.0: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase60AdversarialTests().catch((err) => {
  console.error('Erro na suíte da Fase 6.0:', err);
  process.exit(1);
});
