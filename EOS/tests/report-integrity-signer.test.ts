import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ReportIntegritySigner, canonicalize } from '../core/utils/report-integrity-signer';

// COR-02 (AUD-2026-10-09-03): HMAC sem segredo embutido + canonicalização recursiva.

test('CA-02-01: nenhum literal de chave no fonte do signer', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'core', 'utils', 'report-integrity-signer.ts'),
    'utf8',
  );
  assert.ok(!source.includes('EOS_PHASE_4_1'), 'salt hardcoded removido');
  assert.ok(!source.includes('SECRET_SALT'), 'constante de segredo removida');
});

test('CA-02-02: sign + verify passam com segredo do SecretStore', () => {
  const report = { audit_run_id: 'RUN-test', nested: { a: 1 } };
  const signature = ReportIntegritySigner.signReportContent(report);
  assert.match(signature, /^[0-9a-f]{64}$/);
  assert.strictEqual(ReportIntegritySigner.verifyReportContent(report, signature), true);
  assert.strictEqual(ReportIntegritySigner.verifyReportContent(report, '00'.repeat(32)), false);
});

test('CA-02-03: mutação aninhada invalida a assinatura (repro EOS-SEC-005 invertida)', () => {
  const original = { outer: { inner: 'legitimo', list: [1, 2, { deep: true }] } };
  const signature = ReportIntegritySigner.signReportContent(original);
  const tampered = { outer: { inner: 'forjado', list: [1, 2, { deep: true }] } };
  assert.strictEqual(ReportIntegritySigner.verifyReportContent(tampered, signature), false);
  assert.strictEqual(ReportIntegritySigner.verifyReportContent(original, signature), true);
});

test('CA-02-03b: ordem de chaves não afeta a assinatura (canonicalização)', () => {
  const a = { z: 1, nested: { b: 2, a: 1 } };
  const b = { nested: { a: 1, b: 2 }, z: 1 };
  assert.deepStrictEqual(canonicalize(a), canonicalize(b));
  assert.strictEqual(
    ReportIntegritySigner.signReportContent(a),
    ReportIntegritySigner.signReportContent(b),
  );
});

test('CA-02-05: store inacessível falha fechado (nenhuma assinatura emitida)', () => {
  // Diretório-impossível: SecretStoreService não consegue persistir nem ler;
  // o signer deve lançar em vez de assinar com fallback.
  const blocker = path.join(os.tmpdir(), `eos-cor02-blocker-${Date.now()}.notadir`);
  fs.writeFileSync(blocker, 'bloqueio');
  try {
    const { SecretStoreService } = require('../core/services/secret-store-service');
    assert.throws(
      () => new SecretStoreService(undefined, path.join(blocker, 'sub')),
      /ENOTDIR|ENOENT/,
      'store sem diretório gravável deve falhar na construção (fail-closed)',
    );
  } finally {
    fs.rmSync(blocker, { force: true });
  }
});
