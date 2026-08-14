import test from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import { DurableFactRepository } from '../core/storage/file-fact-repository';
import { FACT_SCHEMA_VERSION_1_0, Fact } from '../core/domain/types';
import { canonicalHash } from '../core/utils/canonical-json';

const fs = require('node:fs');

const TMP_DIR = path.resolve(process.cwd(), 'EOS', 'tests', '.tmp_phase_6_1_6_tests');
if (fs.existsSync(TMP_DIR)) {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TMP_DIR, { recursive: true });

function createDummyFact(id: string): Fact {
  const payload = { a: { b: { c: 'original' } }, x: 0 };
  return {
    fact_id: id,
    schema_version: FACT_SCHEMA_VERSION_1_0,
    fact_type: 'TEST_FACT',
    provider_id: 'test_provider',
    provider_version: '1.0',
    evidence_ids: ['ev1'],
    input_hash: 'a'.repeat(64),
    semantic_hash: canonicalHash(payload),
    lifecycle_status: 'VALID',
    payload,
    composite_confidence: 1.0,
    created_at: Date.now()
  };
}

test('Phase 6.1.6 Storage Integrity Suite', async (t) => {
  const originalWriteFileSync = fs.writeFileSync;
  const originalFsyncSync = fs.fsyncSync;
  const originalCloseSync = fs.closeSync;

  t.afterEach(() => {
    fs.writeFileSync = originalWriteFileSync;
    fs.fsyncSync = originalFsyncSync;
    fs.closeSync = originalCloseSync;
  });

  await t.test('Test A - Falha de escrita não vaza FD', (t) => {
    const storePath = path.join(TMP_DIR, 'store_test_a.json');
    const repo = new DurableFactRepository(storePath);
    const fact = createDummyFact('FA-1');

    let closedFds: number[] = [];
    fs.closeSync = (fd: number) => {
      closedFds.push(fd);
      originalCloseSync(fd);
    };

    fs.writeFileSync = (fd: any, data: any, options: any) => {
      if (typeof fd === 'number') {
        const err = new Error('ENOSPC: no space left on device, write');
        (err as any).code = 'ENOSPC';
        throw err;
      }
      return originalWriteFileSync(fd, data, options);
    };

    let errorThrown = false;
    try {
      repo.save(fact);
    } catch (e: any) {
      errorThrown = true;
      assert.ok(e.message.includes('ENOSPC'), 'Primary error should be preserved in FactIntegrityError message');
    }

    assert.ok(errorThrown, 'Should throw wrapping ENOSPC');
    assert.ok(closedFds.length > 0, 'FD should be closed in finally');
  });

  await t.test('Test B - Falha de fsyncSync não vaza FD', (t) => {
    const storePath = path.join(TMP_DIR, 'store_test_b.json');
    const repo = new DurableFactRepository(storePath);
    const fact = createDummyFact('FB-1');

    let closedFds: number[] = [];
    fs.closeSync = (fd: number) => {
      closedFds.push(fd);
      originalCloseSync(fd);
    };

    fs.fsyncSync = (fd: number) => {
      const err = new Error('EIO: i/o error');
      (err as any).code = 'EIO';
      throw err;
    };

    let errorThrown = false;
    try {
      repo.save(fact);
    } catch (e: any) {
      errorThrown = true;
      assert.ok(e.message.includes('EIO'), 'Primary error should be preserved in FactIntegrityError message');
    }

    assert.ok(errorThrown, 'Should throw wrapping EIO');
    assert.ok(closedFds.length > 0, 'FD should be closed in finally');
  });

  await t.test('Test C - Recuperação Real da Aquisição (Lock Rollback)', (t) => {
    const storePath = path.join(TMP_DIR, 'store_test_c.json');
    const lockPath = `${storePath}.lock`;
    const repo = new DurableFactRepository(storePath);
    const fact1 = createDummyFact('FC-1');
    const fact2 = createDummyFact('FC-2');

    let attempt = 0;
    fs.writeFileSync = (fd: any, data: any, options: any) => {
      attempt++;
      if (attempt === 1) {
        originalWriteFileSync(fd, data, options);
        const err = new Error('ENOSPC: no space left on device, write');
        (err as any).code = 'ENOSPC';
        throw err;
      }
      return originalWriteFileSync(fd, data, options);
    };

    let errorThrown = false;
    try {
      repo.save(fact1);
    } catch (e: any) {
      errorThrown = true;
      assert.ok(e.message.includes('ENOSPC'));
    }
    assert.ok(errorThrown, 'First attempt must fail');
    assert.ok(!fs.existsSync(lockPath), 'Lock file should have been removed by ownership rollback');

    repo.save(fact2); // should not throw
    const persisted = repo.getById('FC-2');
    assert.ok(persisted, 'Second attempt should succeed and persist fact');
  });

  await t.test('Test D - Caller Mutability Preservation', (t) => {
    const storePath = path.join(TMP_DIR, 'store_test_d.json');
    const repo = new DurableFactRepository(storePath);
    const fact = createDummyFact('FD-1');

    repo.save(fact);

    fact.evidence_ids.push('xyz');
    (fact.payload as any).x = 1;

    assert.ok(fact.evidence_ids.includes('xyz'), 'Caller should be able to mutate array');
    assert.strictEqual((fact.payload as any).x, 1, 'Caller should be able to mutate object');
  });

  await t.test('Test E - Repository Memory Isolation (Boundary)', (t) => {
    const storePath = path.join(TMP_DIR, 'store_test_e.json');
    const repo = new DurableFactRepository(storePath);
    const fact = createDummyFact('FE-1');

    repo.save(fact);

    (fact.payload as any).a.b.c = 'caller-mutated';

    const persisted = repo.getById(fact.fact_id);
    
    assert.strictEqual((fact.payload as any).a.b.c, 'caller-mutated', 'Caller mutability check');
    assert.notStrictEqual((persisted?.payload as any).a.b.c, 'caller-mutated', 'Repository must not share mutation');
    
    assert.notStrictEqual(persisted?.payload, fact.payload, 'Payload reference must differ');
    assert.notStrictEqual((persisted?.payload as any).a.b, (fact.payload as any).a.b, 'Deep payload reference must differ');
    assert.notStrictEqual(persisted?.evidence_ids, fact.evidence_ids, 'Array reference must differ');

    (fact.payload as any).a.b.c = 'another-value';
    const persistedAgain = repo.getById(fact.fact_id);
    assert.notStrictEqual((persistedAgain?.payload as any).a.b.c, 'another-value', 'Subsequent GETs must remain isolated');
  });
});
