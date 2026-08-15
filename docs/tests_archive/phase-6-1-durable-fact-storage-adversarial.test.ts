import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { NoDisallowedDependencyRule } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Fact, FACT_SCHEMA_VERSION_1_0 } from '../EOS/core/domain/types';
import {
  FactIntegrityError,
  FactOverwriteForbiddenError,
  FactCorruptedError,
} from '../EOS/core/domain/fact-repository';
import { FileFactRepository, DurableFactRepository } from '../EOS/core/storage/file-fact-repository';
import { canonicalHash, canonicalStringify } from '../EOS/core/utils/canonical-json';

async function runPhase61AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 6.1 — DURABLE FACT STORAGE & RESTART CONSISTENCY');
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

  const tmpDir = path.resolve(__dirname, '.tmp_phase_6_1_tests');

  function getTestStorePath(testId: string): string {
    return path.join(tmpDir, `store_${testId}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  }

  // Cleanup helper
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  const target = TargetResolver.resolve('.');

  function createValidFact(overrides?: Partial<Fact>): Fact {
    const payload = overrides?.payload || {
      fact_type: 'MODULE_DEPENDENCY' as const,
      source_module: 'src/domain/User.ts',
      target_module: 'src/domain/Order.ts',
      import_type: 'STATIC' as const,
      resolution_kind: 'INTERNAL' as const,
      resolution_strategy: 'RELATIVE' as const,
    };

    const semHash = overrides?.semantic_hash || canonicalHash(payload);
    const inpHash = overrides?.input_hash || crypto.createHash('sha256').update('evidence_input_61').digest('hex');

    return {
      fact_id: `FCT-61-${crypto.createHash('md5').update(`${semHash}:${inpHash}`).digest('hex').slice(0, 12)}`,
      schema_version: FACT_SCHEMA_VERSION_1_0,
      fact_type: payload.fact_type,
      provider_id: 'dependency-fact-provider',
      provider_version: '6.1.0',
      evidence_ids: ['EVD-61-01'],
      input_hash: inpHash,
      semantic_hash: semHash,
      lifecycle_status: 'VALID',
      payload: payload,
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  // --- PERSISTENCE & RESTART (FACT-6.1-001..006) ---

  await test('FACT-6.1-001 — save + restart + findById (Persistência durável)', () => {
    const storePath = getTestStorePath('001');
    const repo1 = new DurableFactRepository(storePath);
    const fact = createValidFact();

    repo1.save(fact);

    // Reinicialização de instância isolada
    const repo2 = new DurableFactRepository(storePath);
    const retrieved = repo2.getById(fact.fact_id);

    assert.ok(retrieved, 'Fact deve ser recuperado após restart');
    assert.strictEqual(retrieved?.fact_id, fact.fact_id);
  });

  await test('FACT-6.1-002 — round-trip integral do Fact (Todas as propriedades intactas)', () => {
    const storePath = getTestStorePath('002');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();

    repo1.save(fact);

    const repo2 = new FileFactRepository(storePath);
    const retrieved = repo2.getById(fact.fact_id)!;

    assert.strictEqual(canonicalStringify(retrieved), canonicalStringify(fact));
  });

  await test('FACT-6.1-003 — semantic_hash preservado após restart', () => {
    const storePath = getTestStorePath('003');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.getById(fact.fact_id)?.semantic_hash, fact.semantic_hash);
  });

  await test('FACT-6.1-004 — input_hash preservado após restart', () => {
    const storePath = getTestStorePath('004');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.getById(fact.fact_id)?.input_hash, fact.input_hash);
  });

  await test('FACT-6.1-005 — evidence_ids preservados após restart', () => {
    const storePath = getTestStorePath('005');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const repo2 = new FileFactRepository(storePath);
    assert.deepStrictEqual(repo2.getById(fact.fact_id)?.evidence_ids, fact.evidence_ids);
  });

  await test('FACT-6.1-006 — payload preservado após restart', () => {
    const storePath = getTestStorePath('006');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const repo2 = new FileFactRepository(storePath);
    assert.deepStrictEqual(repo2.getById(fact.fact_id)?.payload, fact.payload);
  });

  // --- IDEMPOTÊNCIA & OVERWRITE (FACT-6.1-007..010) ---

  await test('FACT-6.1-007 — Idempotência em armazenamento durável', () => {
    const storePath = getTestStorePath('007');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();

    repo.save(fact);
    assert.doesNotThrow(() => repo.save(fact));
    assert.strictEqual(repo.getAll().length, 1);
  });

  await test('FACT-6.1-008 — Overwrite de Fact existente com conteúdo diferente é rejeitado', () => {
    const storePath = getTestStorePath('008');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const tampered = { ...fact, composite_confidence: 0.2 };
    assert.throws(() => repo.save(tampered), FactOverwriteForbiddenError);
  });

  await test('FACT-6.1-009 — Schema inválido é rejeitado antes da escrita', () => {
    const storePath = getTestStorePath('009');
    const repo = new FileFactRepository(storePath);
    const invalidSchema = createValidFact({ schema_version: '2.0' });

    assert.throws(() => repo.save(invalidSchema), FactIntegrityError);
    assert.strictEqual(fs.existsSync(storePath), false, 'Arquivo de storage não deve ser criado para escrita inválida');
  });

  await test('FACT-6.1-010 — Fact sem evidência é rejeitado antes da escrita', () => {
    const storePath = getTestStorePath('010');
    const repo = new FileFactRepository(storePath);
    const noEvidence = createValidFact({ evidence_ids: [] });

    assert.throws(() => repo.save(noEvidence), FactIntegrityError);
  });

  // --- SUPERSEDING & HISTÓRICO DURÁVEL (FACT-6.1-011..016) ---

  await test('FACT-6.1-011 — Superseding persistente sobrevive a restart', () => {
    const storePath = getTestStorePath('011');
    const p11 = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'A', target_module: 'B', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(p11);

    const fOld = createValidFact({
      fact_id: 'FCT-DUR-OLD',
      payload: p11,
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_old').digest('hex'),
    });

    const fNew = createValidFact({
      fact_id: 'FCT-DUR-NEW',
      payload: p11,
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_new').digest('hex'),
    });

    const repo1 = new FileFactRepository(storePath);
    repo1.save(fOld);
    repo1.save(fNew);

    // Reinicialização
    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.getById('FCT-DUR-OLD')?.lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(repo2.getById('FCT-DUR-NEW')?.lifecycle_status, 'VALID');
  });

  await test('FACT-6.1-012 — Histórico completo recuperável após restart', () => {
    const storePath = getTestStorePath('012');
    const p12 = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'X', target_module: 'Y', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(p12);

    const repo1 = new FileFactRepository(storePath);
    repo1.save(createValidFact({ fact_id: 'FCT-H1', payload: p12, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('1').digest('hex') }));
    repo1.save(createValidFact({ fact_id: 'FCT-H2', payload: p12, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('2').digest('hex') }));

    const repo2 = new FileFactRepository(storePath);
    const history = repo2.findHistoryBySemanticHash(semHash);
    assert.strictEqual(history.length, 2);
  });

  await test('FACT-6.1-013 — Fact antigo permanece com payload e evidências intactos após superseding', () => {
    const storePath = getTestStorePath('013');
    const p13 = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'M1', target_module: 'M2', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(p13);

    const fOld = createValidFact({
      fact_id: 'FCT-INTACT-OLD',
      payload: p13,
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_old_13').digest('hex'),
      evidence_ids: ['EVD-OLD-13'],
    });

    const fNew = createValidFact({
      fact_id: 'FCT-INTACT-NEW',
      payload: p13,
      semantic_hash: semHash,
      input_hash: crypto.createHash('sha256').update('inp_new_13').digest('hex'),
      evidence_ids: ['EVD-NEW-13'],
    });

    const repo1 = new FileFactRepository(storePath);
    repo1.save(fOld);
    repo1.save(fNew);

    const repo2 = new FileFactRepository(storePath);
    const retrievedOld = repo2.getById('FCT-INTACT-OLD')!;
    assert.strictEqual(retrievedOld.evidence_ids[0], 'EVD-OLD-13');
    assert.strictEqual(retrievedOld.lifecycle_status, 'SUPERSEDED');
  });

  await test('FACT-6.1-014 — Novo Fact permanece VALID após superseding', () => {
    const storePath = getTestStorePath('014');
    const p14 = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'S1', target_module: 'S2', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(p14);

    const fOld = createValidFact({ fact_id: 'FCT-S-1', payload: p14, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('in1').digest('hex') });
    const fNew = createValidFact({ fact_id: 'FCT-S-2', payload: p14, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('in2').digest('hex') });

    const repo1 = new FileFactRepository(storePath);
    repo1.save(fOld);
    repo1.save(fNew);

    const repo2 = new FileFactRepository(storePath);
    const validFact = repo2.findValidBySemanticHash(semHash);
    assert.strictEqual(validFact?.fact_id, 'FCT-S-2');
    assert.strictEqual(validFact?.lifecycle_status, 'VALID');
  });

  await test('FACT-6.1-015 — Atomicidade da gravação de superseding', () => {
    const storePath = getTestStorePath('015');
    const repo = new FileFactRepository(storePath);
    const p15 = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'Atom1', target_module: 'Atom2', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(p15);

    const f1 = createValidFact({ fact_id: 'FCT-ATOM-1', payload: p15, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('a1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-ATOM-2', payload: p15, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('a2').digest('hex') });

    repo.save(f1);
    repo.save(f2);

    // O estado no arquivo em disco deve conter f1 como SUPERSEDED e f2 como VALID
    const rawDisk = fs.readFileSync(storePath, 'utf-8');
    assert.strictEqual(rawDisk.includes('"lifecycle_status":"SUPERSEDED"'), true);
    assert.strictEqual(rawDisk.includes('"lifecycle_status":"VALID"'), true);
  });

  await test('FACT-6.1-016 — Rollback em falha de gravação (Arquivo temporário com erro)', () => {
    const storePath = getTestStorePath('016');
    const repo = new FileFactRepository(storePath);
    const f1 = createValidFact({ fact_id: 'FCT-ROLL-1' });

    repo.save(f1);

    // Tentativa de escrita com objeto inválido que falha na validação
    const badFact = createValidFact({ input_hash: 'bad_hash' });
    assert.throws(() => repo.save(badFact), FactIntegrityError);

    // O arquivo em disco deve continuar 100% válido e intacto apenas com f1
    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.getAll().length, 1);
    assert.strictEqual(repo2.getById('FCT-ROLL-1')?.fact_id, 'FCT-ROLL-1');
  });

  // --- RESTART & CONCORRÊNCIA (FACT-6.1-017, 024, 025, 026) ---

  await test('FACT-6.1-017 — Duas instâncias do repository enxergam o mesmo estado persistido', () => {
    const storePath = getTestStorePath('017');
    const repo1 = new FileFactRepository(storePath);
    const repo2 = new FileFactRepository(storePath);

    const fact = createValidFact({ fact_id: 'FCT-INST-17' });
    repo1.save(fact);

    assert.ok(repo2.getById('FCT-INST-17'));
  });

  await test('FACT-6.1-018 — Corrupção de semantic_hash em disco é detectada no restart', () => {
    const storePath = getTestStorePath('018');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    // Adulteração manual no JSON em disco
    const raw = fs.readFileSync(storePath, 'utf-8');
    const corruptedRaw = raw.replace(fact.semantic_hash, crypto.createHash('sha256').update('hacked').digest('hex'));
    fs.writeFileSync(storePath, corruptedRaw, 'utf-8');

    // Tentativa de inicializar novo repositório deve lançar FactCorruptedError
    assert.throws(() => new FileFactRepository(storePath), FactCorruptedError);
  });

  await test('FACT-6.1-019 — Corrupção de input_hash em disco é detectada no restart', () => {
    const storePath = getTestStorePath('019');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const raw = fs.readFileSync(storePath, 'utf-8');
    const corruptedRaw = raw.replace(fact.input_hash, 'not_valid_sha256');
    fs.writeFileSync(storePath, corruptedRaw, 'utf-8');

    assert.throws(() => new FileFactRepository(storePath), FactCorruptedError);
  });

  await test('FACT-6.1-020 — Corrupção de payload em disco é detectada no restart', () => {
    const storePath = getTestStorePath('020');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const raw = fs.readFileSync(storePath, 'utf-8');
    // Adulterar target_module no JSON mantendo o semantic_hash antigo
    const corruptedRaw = raw.replace('Order.ts', 'Hacked.ts');
    fs.writeFileSync(storePath, corruptedRaw, 'utf-8');

    assert.throws(() => new FileFactRepository(storePath), FactCorruptedError);
  });

  await test('FACT-6.1-021 — Corrupção de lifecycle_status em disco é detectada no restart', () => {
    const storePath = getTestStorePath('021');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const raw = fs.readFileSync(storePath, 'utf-8');
    const corruptedRaw = raw.replace('"lifecycle_status":"VALID"', '"lifecycle_status":"UNKNOWN_STATUS"');
    fs.writeFileSync(storePath, corruptedRaw, 'utf-8');

    assert.throws(() => new FileFactRepository(storePath), FactCorruptedError);
  });

  // --- ISOLAMENTO DE REGRAS (FACT-6.1-022, 023) ---

  await test('FACT-6.1-022 — Rules continuam executando sem I/O ou dependência de storage', () => {
    const rule = new NoDisallowedDependencyRule();
    const fact = createValidFact();
    const evalRes = rule.evaluate([fact], target);
    assert.ok(evalRes);
    assert.strictEqual(evalRes.evaluation.rule_id, NoDisallowedDependencyRule.ruleId);
  });

  await test('FACT-6.1-023 — Rules continuam 100% independentes de storage durável (Análise estática)', () => {
    const rulePath = path.resolve(__dirname, '../EOS/core/rules/no-disallowed-dependency-rule.ts');
    const source = fs.readFileSync(rulePath, 'utf-8');
    assert.strictEqual(source.includes('FileFactRepository'), false);
    assert.strictEqual(source.includes('DurableFactRepository'), false);
    assert.strictEqual(source.includes('fs'), false);
  });

  // --- DETERMINISMO E CONCORRÊNCIA LÓGICA (FACT-6.1-024..030) ---

  await test('FACT-6.1-024 — Determinismo entre execuções duráveis', () => {
    const pathA = getTestStorePath('024_A');
    const pathB = getTestStorePath('024_B');

    const repoA = new FileFactRepository(pathA);
    const repoB = new FileFactRepository(pathB);

    const fact = createValidFact({ fact_id: 'FCT-DET-24' });

    repoA.save(fact);
    repoB.save(fact);

    const contentA = fs.readFileSync(pathA, 'utf-8');
    const contentB = fs.readFileSync(pathB, 'utf-8');

    assert.strictEqual(contentA, contentB, 'Conteúdo dos dois arquivos de armazenamento deve ser idêntico byte a byte');
  });

  await test('FACT-6.1-025 — Concorrência lógica durável: save(A) -> save(A) -> save(B) -> save(A_mutated)', () => {
    const storePath = getTestStorePath('025');
    const repo = new FileFactRepository(storePath);

    const factA = createValidFact({ fact_id: 'FCT-CONC-A' });
    const payloadB = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'B1', target_module: 'B2', import_type: 'STATIC' as const };
    const factB = createValidFact({ fact_id: 'FCT-CONC-B', payload: payloadB });

    // 1. save(A)
    assert.doesNotThrow(() => repo.save(factA));
    // 2. save(A) idempotente
    assert.doesNotThrow(() => repo.save(factA));
    // 3. save(B)
    assert.doesNotThrow(() => repo.save(factB));
    // 4. save(A_tampered) -> REJECT
    const factATampered = { ...factA, composite_confidence: 0.3 };
    assert.throws(() => repo.save(factATampered), FactOverwriteForbiddenError);

    const repoRestart = new FileFactRepository(storePath);
    assert.strictEqual(repoRestart.getAll().length, 2);
  });

  await test('FACT-6.1-026 — Restart após múltiplas versões históricas duráveis', () => {
    const storePath = getTestStorePath('026');
    const payloadMulti = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'Multi1', target_module: 'Multi2', import_type: 'STATIC' as const };
    const semHash = canonicalHash(payloadMulti);

    const f1 = createValidFact({ fact_id: 'FCT-M-1', payload: payloadMulti, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-M-2', payload: payloadMulti, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i2').digest('hex') });
    const f3 = createValidFact({ fact_id: 'FCT-M-3', payload: payloadMulti, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i3').digest('hex') });

    const repo1 = new FileFactRepository(storePath);
    repo1.save(f1);
    repo1.save(f2);
    repo1.save(f3);

    const repo2 = new FileFactRepository(storePath);
    const history = repo2.findHistoryBySemanticHash(semHash);

    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(history[1].lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(history[2].lifecycle_status, 'VALID');
  });

  await test('FACT-6.1-027 — findBySemanticHash() recupera todas as versões após restart', () => {
    const storePath = getTestStorePath('027');
    const payload27 = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'S27_1', target_module: 'S27_2', import_type: 'STATIC' as const };
    const semHash = canonicalHash(payload27);

    const repo1 = new FileFactRepository(storePath);
    repo1.save(createValidFact({ fact_id: 'FCT-27A', payload: payload27, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('in27A').digest('hex') }));
    repo1.save(createValidFact({ fact_id: 'FCT-27B', payload: payload27, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('in27B').digest('hex') }));

    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.findBySemanticHash(semHash).length, 2);
  });

  await test('FACT-6.1-028 — findByInputHash() isola corretamente a proveniência em disco', () => {
    const storePath = getTestStorePath('028');
    const inpX = crypto.createHash('sha256').update('prov_X').digest('hex');
    const inpY = crypto.createHash('sha256').update('prov_Y').digest('hex');

    const repo1 = new FileFactRepository(storePath);
    repo1.save(createValidFact({ fact_id: 'FCT-28X', input_hash: inpX }));
    repo1.save(createValidFact({ fact_id: 'FCT-28Y', input_hash: inpY }));

    const repo2 = new FileFactRepository(storePath);
    const resX = repo2.findByInputHash(inpX);
    assert.strictEqual(resX.length, 1);
    assert.strictEqual(resX[0].fact_id, 'FCT-28X');
  });

  await test('FACT-6.1-029 — Versão de schema incompatível é rejeitada', () => {
    const storePath = getTestStorePath('029');
    const repo = new FileFactRepository(storePath);
    const badSchemaFact = createValidFact({ schema_version: '3.0' });

    assert.throws(() => repo.save(badSchemaFact), FactIntegrityError);
  });

  await test('FACT-6.1-030 — Ausência de Collector durante recuperação histórica (Facts lidos direto do storage)', () => {
    const storePath = getTestStorePath('030');
    const fact = createValidFact({ fact_id: 'FCT-NO-COLLECTOR' });

    const repo1 = new FileFactRepository(storePath);
    repo1.save(fact);

    // Instância totalmente nova sem acionar Collector
    const repo2 = new FileFactRepository(storePath);
    const retrieved = repo2.getById('FCT-NO-COLLECTOR');

    assert.ok(retrieved);
    assert.strictEqual(retrieved?.fact_id, 'FCT-NO-COLLECTOR');
    assert.deepStrictEqual(retrieved?.payload, fact.payload);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 6.1: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase61AdversarialTests().catch((err) => {
  console.error('Erro na suíte da Fase 6.1:', err);
  process.exit(1);
});
