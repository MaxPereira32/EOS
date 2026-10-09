import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GeneratedAppSecurityEngine } from '../core/engines/generated-app-security-engine';

// COR-06 (Fase B): menção ao nome do pacote não é integração; uso real continua sinalizado.

function scanFiles(files: Record<string, string>): string[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor06-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    const result = new GeneratedAppSecurityEngine().scan(root, 'TGT-COR06', false);
    return result.findings.map(f => f.finding_id.split('-').slice(0, 4).join('-'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('CA-06-01: menção ao pacote em lista de dependências não é integração', () => {
  const ids = scanFiles({
    'src/engine.ts': "dependencies['@supabase/supabase-js'] || dependencies.pg;",
  });
  assert.ok(!ids.includes('EOS-GENAI-RLS-001'), 'auto-sinalização eliminada');
});

test('CA-06-02: uso real do client continua sinalizado (sem prova causal)', () => {
  const ids = scanFiles({
    'src/db.ts': "import { createClient } from '@supabase/supabase-js';\nconst db = createClient(url, key);\n",
  });
  assert.ok(ids.includes('EOS-GENAI-RLS-001'), 'integração real ainda detectada');
});

test('CA-06-03: vocabulário de detecção Firebase não é integração', () => {
  const ids = scanFiles({
    'src/rules.ts': "if (content.includes('from \\'firebase/firestore\\'')) { flag(); }\n// Uso de Firebase/Firestore sem regras verificáveis.",
  });
  assert.ok(!ids.includes('EOS-GENAI-RLS-002'), 'menção em vocabulário não sinaliza');
});

test('CA-06-04: uso real do Firestore continua sinalizado', () => {
  const ids = scanFiles({
    'src/db.ts': "import { getFirestore, collection, getDocs } from 'firebase/firestore';\nconst q = collection(getFirestore(app), 'users');\nawait getDocs(q);\n",
  });
  assert.ok(ids.includes('EOS-GENAI-RLS-002'), 'integração real ainda detectada');
});
