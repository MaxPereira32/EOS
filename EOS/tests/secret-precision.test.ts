import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GeneratedAppSecurityEngine } from '../core/engines/generated-app-security-engine';

// COR-07 (Fase B): marcadores REPLACE_WITH_* e declarações de tipo não são segredos.

function scanFiles(files: Record<string, string>): string[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor07-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    const result = new GeneratedAppSecurityEngine().scan(root, 'TGT-COR07', false);
    return result.findings
      .filter(f => f.finding_id.startsWith('EOS-GENAI-SECRET-001'))
      .map(f => f.location);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('CA-07-01: template com REPLACE_WITH_* e union de tipos não sinaliza', () => {
  const secretFindings = scanFiles({
    'policy.example.json': '{\n"token_sha256": "REPLACE_WITH_SHA256_OF_TOKEN",\n"api_key": "REPLACE_WITH_KEY"\n}',
    'src/types.ts': "export type SecretStoreType = 'OS_KEYCHAIN' | 'PASSPHRASE_DERIVED';",
  });
  assert.deepStrictEqual(secretFindings, []);
});

test('CA-07-02: segredo literal real continua detectado', () => {
  const secretFindings = scanFiles({
    'src/config.ts': "const apiKey = 'sk_live_abcdefghijklmnop';",
  });
  assert.strictEqual(secretFindings.length, 1);
  assert.match(secretFindings[0], /config\.ts:1/);
});
