import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';
import { AuditReport } from '../core/domain/types';

// COR-05 (Fase A): declaração arquitetural verdadeira satisfaz a governança.

const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function auditTempProject(writeFixture: (root: string) => void): Promise<AuditReport> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor05-'));
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

test('CA-05-02: perfil declarado idêntico ao inferido, sem contradição', async () => {
  const report = await auditTempProject(root => {
    fs.writeFileSync(path.join(root, 'eos.risk.yml'), 'architecture:\n  profile: cli-or-script\n');
  });

  assert.strictEqual(report.architecture_assessment?.declared_profile, 'CLI_OR_SCRIPT');
  assert.strictEqual(report.architecture_assessment?.effective_profile, 'CLI_OR_SCRIPT');
  assert.strictEqual(report.architecture_assessment?.source, 'DECLARED_AND_INFERRED');
});

test('CA-05-01: eos.risk.yml do próprio EOS declara o perfil verdadeiro', () => {
  const riskPath = path.join(REPO_ROOT, 'eos.risk.yml');
  assert.ok(fs.existsSync(riskPath), 'eos.risk.yml versionado na raiz');
  const content = fs.readFileSync(riskPath, 'utf8');
  assert.match(content, /profile\s*:\s*cli-or-script/);
  assert.ok(!/security_claims/.test(content), 'sem claims declarados sem evidência');
});
