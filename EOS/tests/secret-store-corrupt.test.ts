import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SecretStoreService } from '../core/services/secret-store-service';

// COR-10 (Fase B): distinguir "store ausente" (gerar) de "store ilegível" (falhar fechado).

function tempStore(): { store: SecretStoreService; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor10-'));
  return { store: new SecretStoreService(undefined, root), root };
}

test('CA-10-01: store ausente gera e opera normalmente', t => {
  const { store, root } = tempStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  store.storeCredential('PROV-TESTE', 'segredo-abc-123');
  assert.strictEqual(store.retrieveCredential('PROV-TESTE'), 'segredo-abc-123');
});

test('CA-10-02: store corrompido falha fechado, sem rotação silenciosa', t => {
  const { root } = tempStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storagePath = path.join(root, '.eos', 'credentials.enc.json');
  fs.writeFileSync(storagePath, '{json quebrado!!!', 'utf8');
  const store = new SecretStoreService(undefined, root);
  assert.throws(
    () => store.retrieveCredential('QUALQUER'),
    /CORRUPT_STORE_ERROR/,
    'corrupção deve ser explícita, nunca NOT_FOUND (que geraria chave nova)',
  );
  assert.throws(() => store.storeCredential('X', 'y'.repeat(40)), /CORRUPT_STORE_ERROR/);
});

test('CA-10-02b: JSON válido fora do formato falha fechado', t => {
  const { root } = tempStore();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storagePath = path.join(root, '.eos', 'credentials.enc.json');
  fs.writeFileSync(storagePath, '[1,2,3]', 'utf8');
  const store = new SecretStoreService(undefined, root);
  assert.throws(() => store.retrieveCredential('QUALQUER'), /CORRUPT_STORE_ERROR/);
});
