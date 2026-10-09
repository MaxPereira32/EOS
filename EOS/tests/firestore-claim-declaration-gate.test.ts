import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';
import { AuditReport } from '../core/domain/types';

// COR-01 (AUD-2026-10-09-03): claim Firestore só existe quando declarado.

const RULES_FIXTURE = [
  'rules_version = \'2\';',
  'service cloud.firestore {',
  '  match /databases/{database}/documents {',
  '    match /{document=**} {',
  '      allow read, write: if false;',
  '    }',
  '  }',
  '}',
].join('\n');

async function auditTempProject(writeFixture: (root: string) => void): Promise<AuditReport> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor01-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { test: 'node -e "process.exit(0)"' },
    }));
    writeFixture(root);
    return await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function firestoreClaimIds(report: AuditReport): string[] {
  return (report.security_claims || [])
    .map(claim => claim.claim_id)
    .filter(id => id.includes('FIRESTORE'));
}

function firestoreFindingIds(report: AuditReport): string[] {
  return report.findings
    .map(finding => finding.finding_id)
    .filter(id => id.includes('FIRESTORE'));
}

test('CA-01-01: alvo com firestore.rules e sem declaração não emite claim nem finding Firestore', async () => {
  const report = await auditTempProject(root => {
    fs.writeFileSync(path.join(root, 'firestore.rules'), RULES_FIXTURE);
  });

  assert.deepStrictEqual(firestoreClaimIds(report), []);
  assert.deepStrictEqual(firestoreFindingIds(report), []);
});

test('CA-01-02: ausência do claim não mascara outros vereditos', async () => {
  const report = await auditTempProject(root => {
    fs.writeFileSync(path.join(root, 'firestore.rules'), RULES_FIXTURE);
  });

  const rationale = (report.rule_results || []).map(rule => rule.rationale || '').join('\n');
  assert.match(rationale, /Nenhum claim de segurança ACTIVE foi declarado/);
  assert.ok(!rationale.includes('FIRESTORE'));
});

test('CA-01-04: com claim FIRESTORE ACTIVE declarado, a avaliação legada executa', async () => {
  const report = await auditTempProject(root => {
    fs.writeFileSync(path.join(root, 'firestore.rules'), RULES_FIXTURE);
    fs.writeFileSync(
      path.join(root, 'eos.risk.yml'),
      ['security_claims:', '  - id: SEC-CLAIM-FIRESTORE-001', '    status: ACTIVE', ''].join('\n'),
    );
  });

  assert.ok(
    firestoreClaimIds(report).includes('SEC-CLAIM-FIRESTORE-001'),
    'claim legado deve ser avaliado quando declarado',
  );
});
