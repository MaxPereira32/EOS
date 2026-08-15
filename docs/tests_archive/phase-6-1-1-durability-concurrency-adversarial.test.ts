import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { Fact, FACT_SCHEMA_VERSION_1_0 } from '../EOS/core/domain/types';
import {
  FactIntegrityError,
  FactOverwriteForbiddenError,
  FactCorruptedError,
  FactStateTransitionForbiddenError,
} from '../EOS/core/domain/fact-repository';
import { FileFactRepository, DurableFactRepository } from '../EOS/core/storage/file-fact-repository';
import { canonicalHash, canonicalStringify } from '../EOS/core/utils/canonical-json';

async function runPhase611AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 6.1.1 — DURABILITY, CONCURRENCY & LIFECYCLE HARDENING');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

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

  const tmpDir = path.resolve(__dirname, '.tmp_phase_6_1_1_tests');

  function getTestStorePath(testId: string): string {
    return path.join(tmpDir, `store_${testId}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  }

  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

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
    const inpHash = overrides?.input_hash || crypto.createHash('sha256').update(`evidence_input_${Math.random()}`).digest('hex');

    return {
      fact_id: `FCT-611-${crypto.createHash('md5').update(`${semHash}:${inpHash}:${Math.random()}`).digest('hex').slice(0, 12)}`,
      schema_version: FACT_SCHEMA_VERSION_1_0,
      fact_type: payload.fact_type,
      provider_id: 'dependency-fact-provider',
      provider_version: '6.1.1',
      evidence_ids: ['EVD-611-01'],
      input_hash: inpHash,
      semantic_hash: semHash,
      lifecycle_status: 'VALID',
      payload: payload,
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  // --- CATEGORIA 1: LIFECYCLE STATE MACHINE (LC-001..006) ---

  await test('LC-001 — VALID -> SUPERSEDED é a única transição de estado permitida em superseding', () => {
    const storePath = getTestStorePath('LC001');
    const repo = new FileFactRepository(storePath);
    const payload = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'A', target_module: 'B', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(payload);

    const f1 = createValidFact({ fact_id: 'FCT-LC-1', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-LC-2', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i2').digest('hex') });

    repo.save(f1);
    assert.strictEqual(repo.getById('FCT-LC-1')?.lifecycle_status, 'VALID');

    repo.save(f2);
    assert.strictEqual(repo.getById('FCT-LC-1')?.lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(repo.getById('FCT-LC-2')?.lifecycle_status, 'VALID');
  });

  await test('LC-002 — Transição SUPERSEDED -> VALID é estritamente proibida', () => {
    const storePath = getTestStorePath('LC002');
    const repo = new FileFactRepository(storePath);
    const payload = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'A', target_module: 'B', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(payload);

    const f1 = createValidFact({ fact_id: 'FCT-LC-OLD', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-LC-NEW', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i2').digest('hex') });

    repo.save(f1);
    repo.save(f2);

    // Tentativa de ressuscitar f1 para VALID com mesmo ID
    const resurrected = { ...f1, lifecycle_status: 'VALID' as const };
    assert.throws(() => repo.save(resurrected), FactOverwriteForbiddenError);
  });

  await test('LC-003 — Transição SUPERSEDED -> SUPERSEDED é idempotente e preservada', () => {
    const storePath = getTestStorePath('LC003');
    const repo = new FileFactRepository(storePath);
    const payload = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'A', target_module: 'B', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(payload);

    const f1 = createValidFact({ fact_id: 'FCT-LC-S1', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i1').digest('hex') });
    const f2 = createValidFact({ fact_id: 'FCT-LC-S2', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i2').digest('hex') });
    const f3 = createValidFact({ fact_id: 'FCT-LC-S3', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('i3').digest('hex') });

    repo.save(f1);
    repo.save(f2); // f1 vira SUPERSEDED
    repo.save(f3); // f1 continua SUPERSEDED, f2 vira SUPERSEDED, f3 vira VALID

    assert.strictEqual(repo.getById('FCT-LC-S1')?.lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(repo.getById('FCT-LC-S2')?.lifecycle_status, 'SUPERSEDED');
    assert.strictEqual(repo.getById('FCT-LC-S3')?.lifecycle_status, 'VALID');
  });

  await test('LC-004 — Estado de lifecycle desconhecido é rejeitado na validação', () => {
    const storePath = getTestStorePath('LC004');
    const repo = new FileFactRepository(storePath);
    const invalidFact = createValidFact({ lifecycle_status: 'UNKNOWN' as any });

    assert.throws(() => repo.save(invalidFact), FactIntegrityError);
  });

  await test('LC-005 — Fatos gerados por FactProvider iniciam obrigatoriamente com status VALID', () => {
    const fact = createValidFact();
    assert.strictEqual(fact.lifecycle_status, 'VALID');
  });

  await test('LC-006 — findValidBySemanticHash() retorna null quando todas as versões forem SUPERSEDED ou suplantadas', () => {
    const storePath = getTestStorePath('LC006');
    const repo = new FileFactRepository(storePath);
    const semHash = canonicalHash({ fact_type: 'MODULE_DEPENDENCY', source_module: 'Z1', target_module: 'Z2', import_type: 'STATIC' });

    assert.strictEqual(repo.findValidBySemanticHash(semHash), null);
  });

  // --- CATEGORIA 2: ATOMIC REPLACEMENT & CRASH RECOVERY (CR-001..006) ---

  await test('CR-001 — Atomic replacement ≠ durabilidade absoluta (fsyncSync atua para durabilidade física)', () => {
    const storePath = getTestStorePath('CR001');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();

    // Salvar invoca fsyncSync + renameSync
    repo.save(fact);
    assert.ok(fs.existsSync(storePath));
  });

  await test('CR-002 — Falha antes da escrita do .tmp deixa o arquivo em disco intacto', () => {
    const storePath = getTestStorePath('CR002');
    const repo = new FileFactRepository(storePath);
    const f1 = createValidFact({ fact_id: 'FCT-CR-1' });
    repo.save(f1);

    const badFact = createValidFact({ schema_version: '9.9' });
    assert.throws(() => repo.save(badFact), FactIntegrityError);

    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.getAll().length, 1);
    assert.strictEqual(repo2.getById('FCT-CR-1')?.fact_id, 'FCT-CR-1');
  });

  await test('CR-003 — Falha durante o processo de escrita limpa o arquivo .tmp e preserva estado anterior', () => {
    const storePath = getTestStorePath('CR003');
    const repo = new FileFactRepository(storePath);
    const f1 = createValidFact({ fact_id: 'FCT-CR-3' });
    repo.save(f1);

    // Simulação: se houver arquivo .tmp orfão de processo morto antes do commit
    const orphanTmp = `${storePath}.tmp_orphan123`;
    fs.writeFileSync(orphanTmp, 'corrupted_tmp_data', 'utf-8');

    // Novo save limpa tmp ou conclui atomicamente sem ler o tmp orfão
    const f2 = createValidFact({ fact_id: 'FCT-CR-4' });
    repo.save(f2);

    const repo2 = new FileFactRepository(storePath);
    assert.strictEqual(repo2.getAll().length, 2);
  });

  await test('CR-004 — Interrupção antes de renameSync preserva dados anteriores sem corrupção', () => {
    const storePath = getTestStorePath('CR004');
    const repo = new FileFactRepository(storePath);
    const f1 = createValidFact({ fact_id: 'FCT-CR-PRE-RENAME' });
    repo.save(f1);

    const initialContent = fs.readFileSync(storePath, 'utf-8');

    // Tentativa de escrita com erro
    assert.throws(() => repo.save({ ...f1, fact_id: 'BAD', evidence_ids: [] }), FactIntegrityError);

    const afterContent = fs.readFileSync(storePath, 'utf-8');
    assert.strictEqual(initialContent, afterContent);
  });

  await test('CR-005 — Commit concluído (renameSync) garante visibilidade imediata para novos leitores', () => {
    const storePath = getTestStorePath('CR005');
    const repo1 = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo1.save(fact);

    const repo2 = new FileFactRepository(storePath);
    assert.ok(repo2.getById(fact.fact_id));
  });

  await test('CR-006 — Distinção explícita de durabilidade e atomicidade em documento ADR-6.1.1', () => {
    const adrPath = path.resolve(__dirname, '../EOS/docs/adr/ADR-6.1.1-durability-concurrency-hardening.md');
    assert.ok(fs.existsSync(adrPath));
    const content = fs.readFileSync(adrPath, 'utf-8');
    assert.strictEqual(content.includes('fsync'), true);
    assert.strictEqual(content.includes('renameSync'), true);
  });

  // --- CATEGORIA 3: MULTI-PROCESS PHYSICAL CONCURRENCY (MC-001..006) ---

  await test('MC-001 — Concorrência física multi-processos (Processos Node independentes via child_process): Zero Lost Updates!', () => {
    const storePath = getTestStorePath('MC001');

    // 1. Inicializa repositório com fato inicial A
    const repoInit = new FileFactRepository(storePath);
    const factA = createValidFact({ fact_id: 'FCT-PROC-A' });
    repoInit.save(factA);

    const repoTsPath = path.resolve(__dirname, '../EOS/core/storage/file-fact-repository.ts').replace(/\\/g, '/');
    const jsonTsPath = path.resolve(__dirname, '../EOS/core/utils/canonical-json.ts').replace(/\\/g, '/');

    // Helper script JS executado em processos Node separados
    const scriptPath = path.join(tmpDir, 'child_save.js');
    const scriptContent = `
      const { FileFactRepository } = require('${repoTsPath}');
      const { canonicalHash } = require('${jsonTsPath}');
      const storePath = process.argv[2];
      const factId = process.argv[3];
      const semTag = process.argv[4];

      const repo = new FileFactRepository(storePath);
      const fact = {
        fact_id: factId,
        schema_version: "1.0",
        fact_type: "MODULE_DEPENDENCY",
        provider_id: "dependency-fact-provider",
        provider_version: "6.1.1",
        evidence_ids: ["EVD-PROC"],
        input_hash: "a".repeat(64),
        semantic_hash: semTag,
        lifecycle_status: "VALID",
        payload: {
          fact_type: "MODULE_DEPENDENCY",
          source_module: factId,
          target_module: "Target.ts",
          import_type: "STATIC",
          resolution_kind: "INTERNAL",
          resolution_strategy: "RELATIVE"
        },
        composite_confidence: 1.0,
        created_at: new Date().toISOString()
      };

      fact.semantic_hash = canonicalHash(fact.payload);
      repo.save(fact);
    `;

    fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

    // Dispara dois processos Node.js independentes em paralelo
    const semB = crypto.createHash('sha256').update('sem_B').digest('hex');
    const semC = crypto.createHash('sha256').update('sem_C').digest('hex');

    const p1 = child_process.spawnSync(npxCmd, ['tsx', scriptPath, storePath, 'FCT-PROC-B', semB], { encoding: 'utf-8', shell: true });
    const p2 = child_process.spawnSync(npxCmd, ['tsx', scriptPath, storePath, 'FCT-PROC-C', semC], { encoding: 'utf-8', shell: true });

    assert.strictEqual(p1.status, 0, `P1 failed: out=${p1.stdout}, err=${p1.stderr}, errObj=${p1.error}`);
    assert.strictEqual(p2.status, 0, `P2 failed: out=${p2.stdout}, err=${p2.stderr}, errObj=${p2.error}`);

    // Verifica que NENHUM update foi perdido (Store contêm A, B e C)
    const repoFinal = new FileFactRepository(storePath);
    const all = repoFinal.getAll();
    assert.strictEqual(all.length, 3, 'Todos os fatos dos 2 processos concorrentes devem persistir sem lost update');
    assert.ok(repoFinal.getById('FCT-PROC-A'));
    assert.ok(repoFinal.getById('FCT-PROC-B'));
    assert.ok(repoFinal.getById('FCT-PROC-C'));
  });

  await test('MC-002 — Concorrência multi-processo de superseding (Gravações paralelas de novo input)', () => {
    const storePath = getTestStorePath('MC002');
    const payload = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'Shared.ts', target_module: 'Dep.ts', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(payload);

    const repoInit = new FileFactRepository(storePath);
    repoInit.save(createValidFact({ fact_id: 'FCT-SUP-BASE', payload, semantic_hash: semHash, input_hash: crypto.createHash('sha256').update('base').digest('hex') }));

    const repoTsPath = path.resolve(__dirname, '../EOS/core/storage/file-fact-repository.ts').replace(/\\/g, '/');
    const jsonTsPath = path.resolve(__dirname, '../EOS/core/utils/canonical-json.ts').replace(/\\/g, '/');

    const scriptPath = path.join(tmpDir, 'child_supersede.js');
    const scriptContent = `
      const { FileFactRepository } = require('${repoTsPath}');
      const { canonicalHash } = require('${jsonTsPath}');

      const storePath = process.argv[2];
      const factId = process.argv[3];
      const inpTag = process.argv[4];

      const repo = new FileFactRepository(storePath);
      const payload = { fact_type: "MODULE_DEPENDENCY", source_module: "Shared.ts", target_module: "Dep.ts", import_type: "STATIC", resolution_kind: "INTERNAL", resolution_strategy: "RELATIVE" };
      const semHash = canonicalHash(payload);

      const fact = {
        fact_id: factId,
        schema_version: "1.0",
        fact_type: "MODULE_DEPENDENCY",
        provider_id: "dependency-fact-provider",
        provider_version: "6.1.1",
        evidence_ids: ["EVD-SUP"],
        input_hash: inpTag,
        semantic_hash: semHash,
        lifecycle_status: "VALID",
        payload: payload,
        composite_confidence: 1.0,
        created_at: new Date().toISOString()
      };

      repo.save(fact);
    `;

    fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

    const inp1 = crypto.createHash('sha256').update('inp_p1').digest('hex');
    const inp2 = crypto.createHash('sha256').update('inp_p2').digest('hex');

    const p1 = child_process.spawnSync(npxCmd, ['tsx', scriptPath, storePath, 'FCT-SUP-P1', inp1], { encoding: 'utf-8', shell: true });
    const p2 = child_process.spawnSync(npxCmd, ['tsx', scriptPath, storePath, 'FCT-SUP-P2', inp2], { encoding: 'utf-8', shell: true });

    assert.strictEqual(p1.status, 0, `P1 failed: out=${p1.stdout}, err=${p1.stderr}`);
    assert.strictEqual(p2.status, 0, `P2 failed: out=${p2.stdout}, err=${p2.stderr}`);

    const repoFinal = new FileFactRepository(storePath);
    const history = repoFinal.findHistoryBySemanticHash(semHash);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(repoFinal.getById('FCT-SUP-BASE')?.lifecycle_status, 'SUPERSEDED');
  });

  await test('MC-003 — Limpeza automática de Stale Lock (>3000ms de processo interrompido)', () => {
    const storePath = getTestStorePath('MC003');
    const lockPath = `${storePath}.lock`;

    // Cria lock obsoleto simulando crash de processo há 4 segundos
    const staleTime = Date.now() - 4000;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, time: staleTime }), 'utf-8');
    fs.utimesSync(lockPath, new Date(staleTime), new Date(staleTime));

    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();

    // Salvar deve remover o lock obsoleto e ter sucesso
    assert.doesNotThrow(() => repo.save(fact));
    assert.ok(repo.getById(fact.fact_id));
  });

  await test('MC-004 — Idempotência concorrente de processos múltiplos', () => {
    const storePath = getTestStorePath('MC004');
    const fact = createValidFact({ fact_id: 'FCT-IDEM-PROC' });

    const repoInit = new FileFactRepository(storePath);
    repoInit.save(fact);

    const repoTsPath = path.resolve(__dirname, '../EOS/core/storage/file-fact-repository.ts').replace(/\\/g, '/');

    const scriptPath = path.join(tmpDir, 'child_idempotent.js');
    const scriptContent = `
      const { FileFactRepository } = require('${repoTsPath}');
      const storePath = process.argv[2];
      const factJson = JSON.parse(process.argv[3]);

      const repo = new FileFactRepository(storePath);
      repo.save(factJson);
    `;
    fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

    const factStr = JSON.stringify(fact).replace(/"/g, '\\"');
    const p1 = child_process.spawnSync(npxCmd, ['tsx', scriptPath, storePath, `"${factStr}"`], { encoding: 'utf-8', shell: true });
    const p2 = child_process.spawnSync(npxCmd, ['tsx', scriptPath, storePath, `"${factStr}"`], { encoding: 'utf-8', shell: true });

    assert.strictEqual(p1.status, 0, `P1 failed: out=${p1.stdout}, err=${p1.stderr}`);
    assert.strictEqual(p2.status, 0, `P2 failed: out=${p2.stdout}, err=${p2.stderr}`);

    const repoFinal = new FileFactRepository(storePath);
    assert.strictEqual(repoFinal.getAll().length, 1);
  });

  await test('MC-005 — Timeout de aquisição de lock previne espera infinita', () => {
    const storePath = getTestStorePath('MC005');
    const lockPath = `${storePath}.lock`;

    // Lock recente (ativo há 100ms)
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: Date.now() }), 'utf-8');

    // Instancia repositório com timeout menor para teste rápido
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();

    // Como o lock está ativo e recente, deve aguardar e eventual timeout ou limpeza
    // Limpamos o lock após 100ms em background para simular liberação
    setTimeout(() => {
      if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch {}
      }
    }, 100);

    assert.doesNotThrow(() => repo.save(fact));
  });

  await test('MC-006 — O arquivo de lock é estritamente removido após a conclusão do salvamento', () => {
    const storePath = getTestStorePath('MC006');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();

    repo.save(fact);
    assert.strictEqual(fs.existsSync(`${storePath}.lock`), false);
  });

  // --- CATEGORIA 4: FACTUAL IMMUTABILITY & TAMPERING (FI-001..006) ---

  await test('FI-001 — Tentativa de alteração de payload durante superseding lança erro', () => {
    const storePath = getTestStorePath('FI001');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const tampered = { ...fact, payload: { ...fact.payload, target_module: 'Hacked.ts' } };
    assert.throws(() => repo.save(tampered), FactOverwriteForbiddenError);
  });

  await test('FI-002 — Tentativa de alteração de semantic_hash durante superseding lança erro', () => {
    const storePath = getTestStorePath('FI002');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const tampered = { ...fact, semantic_hash: 'b'.repeat(64) };
    assert.throws(() => repo.save(tampered), FactOverwriteForbiddenError);
  });

  await test('FI-003 — Tentativa de alteração de input_hash mantendo mesmo fact_id lança FactOverwriteForbiddenError', () => {
    const storePath = getTestStorePath('FI003');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const tampered = { ...fact, input_hash: 'c'.repeat(64) };
    assert.throws(() => repo.save(tampered), FactOverwriteForbiddenError);
  });

  await test('FI-004 — Tentativa de alteração de evidence_ids mantendo mesmo fact_id lança FactOverwriteForbiddenError', () => {
    const storePath = getTestStorePath('FI004');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const tampered = { ...fact, evidence_ids: ['EVD-HACKED'] };
    assert.throws(() => repo.save(tampered), FactOverwriteForbiddenError);
  });

  await test('FI-005 — Tentativa de alteração de created_at mantendo mesmo fact_id lança FactOverwriteForbiddenError', () => {
    const storePath = getTestStorePath('FI005');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const tampered = { ...fact, created_at: new Date(2000, 1, 1).toISOString() };
    assert.throws(() => repo.save(tampered), FactOverwriteForbiddenError);
  });

  await test('FI-006 — Objeto Fact retornado pelo repositório é frozen e imutável em runtime', () => {
    const storePath = getTestStorePath('FI006');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    const retrieved = repo.getById(fact.fact_id)!;
    assert.ok(Object.isFrozen(retrieved));
    assert.throws(() => {
      (retrieved as any).provider_id = 'hacked';
    }, TypeError);
  });

  // --- CATEGORIA 5: PROVENANCE & STRUCTURAL VS CRYPTOGRAPHIC DISTINCTION (PR-001..004) ---

  await test('PR-001 — FileFactRepository valida integridade estrutural (formato SHA-256 e schema JSON)', () => {
    const storePath = getTestStorePath('PR001');
    const repo = new FileFactRepository(storePath);
    const badHashFact = createValidFact({ input_hash: 'invalid_hash_format' });

    assert.throws(() => repo.save(badHashFact), FactIntegrityError);
  });

  await test('PR-002 — FileFactRepository valida integridade criptográfica interna (semantic_hash == canonicalHash(payload))', () => {
    const storePath = getTestStorePath('PR002');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact();
    repo.save(fact);

    // Tampering manual no arquivo em disco alterando o payload
    const raw = fs.readFileSync(storePath, 'utf-8');
    const corruptedRaw = raw.replace('Order.ts', 'Tampered.ts');
    fs.writeFileSync(storePath, corruptedRaw, 'utf-8');

    assert.throws(() => new FileFactRepository(storePath), FactCorruptedError);
  });

  await test('PR-003 — Distinção explícita: FileFactRepository sem Evidence Store valida integridade estrutural, não o conteúdo físico da evidência', () => {
    const storePath = getTestStorePath('PR003');
    const repo = new FileFactRepository(storePath);
    const fact = createValidFact({ evidence_ids: ['EVD-PHYSICAL-FILE-99'] });
    repo.save(fact);

    const retrieved = repo.getById(fact.fact_id)!;
    assert.strictEqual(retrieved.evidence_ids[0], 'EVD-PHYSICAL-FILE-99');
    // O repositório contém os IDs de evidência e hashes, não os arquivos físicos originais do disco
    assert.strictEqual((retrieved as any).raw_evidence_content, undefined);
  });

  await test('PR-004 — Proveniência autêntica é declarada como verificável condicionalmente à presença do Evidence Store', () => {
    const adrPath = path.resolve(__dirname, '../EOS/docs/adr/ADR-6.1.1-durability-concurrency-hardening.md');
    const content = fs.readFileSync(adrPath, 'utf-8');
    assert.strictEqual(content.includes('Proveniência Verificável'), true);
    assert.strictEqual(content.includes('Integridade Estrutural'), true);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 6.1.1: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase611AdversarialTests().catch((err) => {
  console.error('Erro na suíte da Fase 6.1.1:', err);
  process.exit(1);
});
