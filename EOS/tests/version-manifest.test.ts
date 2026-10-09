import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// COR-08 (Fase A): manifesto de versão sincronizado com o pacote.

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('CA-08-01: EOS/eos-version.md declara a versão efetiva do pacote', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const manifest = fs.readFileSync(path.join(REPO_ROOT, 'EOS', 'eos-version.md'), 'utf8');
  assert.match(manifest, new RegExp(`v${pkg.version.replace(/\./g, '\\.')}`));
  assert.ok(!/Versão Ativa.*v0\.9\.0/.test(manifest), 'bloco de identificação não pode estar obsoleto');
});
