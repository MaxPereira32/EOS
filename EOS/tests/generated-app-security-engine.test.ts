import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GeneratedAppSecurityEngine } from '../core/engines/generated-app-security-engine';

test('detecta riscos comuns de app gerado por IA com arquivo e linha verificáveis', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-security-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.ts'), [
      "import { createClient } from '@supabase/supabase-js';",
      "const apiKey = 'sk_live_abcdefghijk';",
      "if (user.role === 'admin') window.showAdmin = true;",
      "const row = await prisma.document.findUnique({ where: { id: req.params.id } });",
      'const payload = req.body;',
      'upload.single(\'file\');',
      'const client = createClient(url, key);',
    ].join('\n'));
    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const ids = result.findings.map(finding => finding.finding_id.split('-').slice(0, 4).join('-'));
    assert.ok(ids.includes('EOS-GENAI-RLS-001'));
    assert.ok(ids.includes('EOS-GENAI-AUTHZ-001'));
    assert.ok(ids.includes('EOS-GENAI-IDOR-001'));
    assert.ok(ids.includes('EOS-GENAI-SECRET-001'));
    assert.ok(ids.includes('EOS-GENAI-INPUT-001'));
    assert.ok(ids.includes('EOS-GENAI-UPLOAD-001'));
    assert.equal(result.rule.status, 'FAIL');
    for (const finding of result.findings) {
      assert.match(finding.location, /^src\/app\.ts:\d+$/);
      assert.match(finding.description, /Risco:.*Correção:/s);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('integração de dados sem claim RLS causalmente provado permanece inconclusiva', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-rls-evidence-'));
  try {
    fs.mkdirSync(path.join(root, 'supabase'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src.ts'), "import { createClient } from '@supabase/supabase-js';\ncreateClient(url, key);\n");
    fs.writeFileSync(path.join(root, 'supabase', 'policy.sql'), 'ALTER TABLE documents ENABLE ROW LEVEL SECURITY;\nCREATE POLICY tenant ON documents USING (true);\n');
    const insufficient = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const proven = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', true);
    assert.equal(insufficient.findings.length, 0);
    assert.equal(insufficient.rule.status, 'INSUFFICIENT_EVIDENCE');
    assert.equal(proven.rule.status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
