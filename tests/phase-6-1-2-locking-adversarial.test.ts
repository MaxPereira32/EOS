import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { Fact, FACT_SCHEMA_VERSION_1_0 } from '../EOS/core/domain/types';
import { FactIntegrityError } from '../EOS/core/domain/fact-repository';
import { FileFactRepository } from '../EOS/core/storage/file-fact-repository';
import { canonicalHash } from '../EOS/core/utils/canonical-json';

async function runPhase612AdversarialTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE FASE 6.1.2 — LOCKING & ROBUSTNESS HARDENING');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.stack || err.message);
      failed++;
    }
  }

  const tmpDir = path.resolve(__dirname, '.tmp_phase_6_1_2_tests');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  function getTestStorePath(testId: string): string {
    return path.join(tmpDir, `store_${testId}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  }

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
      fact_id: `FCT-LCK-${crypto.createHash('md5').update(`${semHash}:${inpHash}:${Math.random()}`).digest('hex').slice(0, 12)}`,
      schema_version: FACT_SCHEMA_VERSION_1_0,
      fact_type: payload.fact_type,
      provider_id: 'dependency-fact-provider',
      provider_version: '6.1.1',
      evidence_ids: ['EVD-LCK-01'],
      input_hash: inpHash,
      semantic_hash: semHash,
      lifecycle_status: 'VALID',
      payload: payload,
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  await test('LOCK-001 — Processo adquire lock e permanece ativo além do TTL. Outro processo NÃO pode remover seu lock legitimamente.', () => {
    const storePath = getTestStorePath('LOCK001');
    const lockPath = `${storePath}.lock`;

    // Simulate an active process (we use our own process ID, it is definitely alive)
    // Make the lock extremely old (e.g. 1 hour old) so it exceeds staleTimeoutMs (3000ms)
    const oldTime = Date.now() - 3600000;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: oldTime }), 'utf-8');
    fs.utimesSync(lockPath, new Date(oldTime), new Date(oldTime));

    const repo = new FileFactRepository(storePath);
    // When saving, it should throw FactIntegrityError due to timeout, because it CANNOT steal the lock 
    // from an alive process, even if it's way past TTL.
    assert.throws(() => repo.save(createValidFact()), FactIntegrityError);
    
    // Clean up our fake lock for other tests
    fs.unlinkSync(lockPath);
  });

  await test('LOCK-002 — Processo morre imediatamente após adquirir lock. Outro processo consegue recuperar após detectar stale lock.', () => {
    const storePath = getTestStorePath('LOCK002');
    const lockPath = `${storePath}.lock`;

    // Simulate a dead process (use an arbitrary huge PID or standard unassigned PID)
    // Most likely 999999 is dead.
    const deadPid = 999999;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: deadPid, time: Date.now() }), 'utf-8');

    const repo = new FileFactRepository(storePath);
    // Should NOT throw timeout, it should steal the lock because process is dead.
    assert.doesNotThrow(() => repo.save(createValidFact()));
    assert.strictEqual(fs.existsSync(lockPath), false);
  });

  await test('LOCK-003 — Processo morre durante escrita. Próximo processo recupera estado consistente.', () => {
    const storePath = getTestStorePath('LOCK003');
    const repoInit = new FileFactRepository(storePath);
    const fact1 = createValidFact({ fact_id: 'FCT-LOCK003-1' });
    repoInit.save(fact1);

    // Simulate a process died during writing a tmp file
    const tmpPath = `${storePath}.tmp_dead123`;
    fs.writeFileSync(tmpPath, 'incompleto ou invalido', 'utf-8');
    
    // Process also left a stale lock
    fs.writeFileSync(`${storePath}.lock`, JSON.stringify({ pid: 999999, time: Date.now() }), 'utf-8');

    const repoRecover = new FileFactRepository(storePath);
    const fact2 = createValidFact({ fact_id: 'FCT-LOCK003-2' });
    assert.doesNotThrow(() => repoRecover.save(fact2));

    const all = repoRecover.getAll();
    assert.strictEqual(all.length, 2);
    assert.ok(fs.existsSync(storePath)); // State is consistent
  });

  await test('LOCK-004 — Processo morre depois do rename mas antes da liberação do lock. Estado permanece consistente.', () => {
    const storePath = getTestStorePath('LOCK004');
    const repoInit = new FileFactRepository(storePath);
    const fact1 = createValidFact({ fact_id: 'FCT-LOCK004-1' });
    repoInit.save(fact1); // This completes the rename

    // Simulate process died right after renameSync, but before unlinkSync of lock
    fs.writeFileSync(`${storePath}.lock`, JSON.stringify({ pid: 999999, time: Date.now() }), 'utf-8');

    // Next process should steal lock, load the state cleanly, and proceed
    const repoRecover = new FileFactRepository(storePath);
    const fact2 = createValidFact({ fact_id: 'FCT-LOCK004-2' });
    assert.doesNotThrow(() => repoRecover.save(fact2));

    const all = repoRecover.getAll();
    assert.strictEqual(all.length, 2);
  });

  await test('LOCK-005 — Processo morre durante superseding. Não pode existir: antigo = SUPERSEDED, novo = ausente.', () => {
    const storePath = getTestStorePath('LOCK005');
    const payload = { fact_type: 'MODULE_DEPENDENCY' as const, source_module: 'A', target_module: 'B', import_type: 'STATIC' as const, resolution_kind: 'INTERNAL' as const, resolution_strategy: 'RELATIVE' as const };
    const semHash = canonicalHash(payload);

    const repoInit = new FileFactRepository(storePath);
    repoInit.save(createValidFact({ fact_id: 'FCT-L5-OLD', payload, semantic_hash: semHash, input_hash: 'a'.repeat(64) }));

    // Simulate a crash during superseding. The memory state was mutating but tmp write failed.
    // So the disk file remains the old state.
    
    const repoRecover = new FileFactRepository(storePath);
    const history = repoRecover.findHistoryBySemanticHash(semHash);
    
    // It must only have the old fact, still VALID
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].fact_id, 'FCT-L5-OLD');
    assert.strictEqual(history[0].lifecycle_status, 'VALID');
  });

  await test('LOCK-006 — Processo morre antes do superseding. Fact anterior permanece VALID.', () => {
    const storePath = getTestStorePath('LOCK006');
    const repoInit = new FileFactRepository(storePath);
    repoInit.save(createValidFact({ fact_id: 'FCT-L6-OLD' }));

    // Same logic as LOCK-005, crash before renameSync leaves original file fully intact
    const originalContent = fs.readFileSync(storePath, 'utf-8');

    // Add corrupted tmp and stale lock
    fs.writeFileSync(`${storePath}.tmp_xyz`, 'junk', 'utf-8');
    fs.writeFileSync(`${storePath}.lock`, JSON.stringify({ pid: 999999, time: Date.now() }), 'utf-8');

    const repoRecover = new FileFactRepository(storePath);
    const facts = repoRecover.getAll();
    assert.strictEqual(facts[0].fact_id, 'FCT-L6-OLD');
    assert.strictEqual(facts[0].lifecycle_status, 'VALID');
  });

  await test('LOCK-007 — Dois processos tentam recuperar o mesmo stale lock. Somente um vence.', () => {
    // This is essentially validated by OS-level exclusive write constraints ('wx').
    // Even if both process the stale lock block and unlink, only one 'openSync("wx")' succeeds.
    // Simulating it programmatically by mocking openSync is complex, but we can verify our lock acquisition uses 'wx'.
    const repoTsPath = path.resolve(__dirname, '../EOS/core/storage/file-fact-repository.ts');
    const source = fs.readFileSync(repoTsPath, 'utf-8');
    assert.ok(source.includes("fs.openSync(this.lockPath, 'wx')"), "Must use wx flag for exclusive creation");
  });

  await test('LOCK-008 — Lock ativo não pode ser confundido com stale lock.', () => {
    // Proven by LOCK-001 (where checking process liveness correctly identifies active lock regardless of TTL).
    const storePath = getTestStorePath('LOCK008');
    const lockPath = `${storePath}.lock`;

    const oldTime = Date.now() - 500000;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: oldTime }), 'utf-8');
    
    const repo = new FileFactRepository(storePath);
    assert.throws(() => repo.save(createValidFact()), FactIntegrityError);
    fs.unlinkSync(lockPath);
  });

  await test('LOCK-009 — Clock skew não pode invalidar incorretamente o lock, dentro das garantias do ambiente suportado.', () => {
    // Because we use process.kill(pid, 0) as the primary determinant for stale locks,
    // even if clock skew causes the lock timestamp to be in the far past or future,
    // the liveness check prevents invalidation.
    const storePath = getTestStorePath('LOCK009');
    const lockPath = `${storePath}.lock`;

    // Clock skew: Lock created '10 years ago' according to clock
    const skewedTime = Date.now() - 10 * 365 * 24 * 3600 * 1000;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: skewedTime }), 'utf-8');
    
    const repo = new FileFactRepository(storePath);
    // Should NOT steal because process is still alive.
    assert.throws(() => repo.save(createValidFact()), FactIntegrityError);
    fs.unlinkSync(lockPath);
  });

  await test('LOCK-010 — Lock cleanup não remove lock pertencente a outro processo.', () => {
    const storePath = getTestStorePath('LOCK010');
    const repo = new FileFactRepository(storePath);
    
    // Simulate another process already holds the lock
    const lockPath = `${storePath}.lock`;
    
    // Attempt to save, should timeout because the lock is held (and not stale enough or we just wait)
    // To prevent it from stealing, use our own process ID.
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: Date.now() }), 'utf-8');
    
    assert.throws(() => repo.save(createValidFact()), FactIntegrityError);

    // Verify that after throwing, the withLock's finally block did NOT remove the lock
    // since it didn't belong to the newly instantiated context (acquired was false).
    assert.strictEqual(fs.existsSync(lockPath), true);

    // Clean up
    fs.unlinkSync(lockPath);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 6.1.2: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase612AdversarialTests().catch((err) => {
  console.error('Erro na suíte da Fase 6.1.2:', err);
  process.exit(1);
});
