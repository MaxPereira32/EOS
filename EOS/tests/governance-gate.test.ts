import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';
import { AuditReport } from '../core/domain/types';

async function auditTempProject(writeFixture: (root: string) => void): Promise<AuditReport> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-governance-gate-'));
  try {
    writeFixture(root);
    return await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writePassingPackageJson(root: string): void {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: { test: 'node -e "process.exit(0)"' }
  }));
}

test('sem artefatos de governança o gate fica INSUFFICIENT_EVIDENCE e impede GREEN', async () => {
  const report = await auditTempProject(root => {
    writePassingPackageJson(root);
  });

  const rule = report.rule_results.find(item => item.rule_id === 'EOS-GOVERNANCE-001');
  assert.strictEqual(rule?.status, 'INSUFFICIENT_EVIDENCE');
  assert.match(rule?.rationale ?? '', /governança parcial/i);
  assert.strictEqual(report.overall_phase_status, 'BLOCKED');
});

test('com os três artefatos de .eos/ o gate de governança é satisfeito', async () => {
  const report = await auditTempProject(root => {
    writePassingPackageJson(root);
    fs.mkdirSync(path.join(root, '.eos'), { recursive: true });
    for (const doc of ['contexto.md', 'arquitetura-atual.md', 'decisores.md']) {
      fs.writeFileSync(path.join(root, '.eos', doc), '# documento\n');
    }
  });

  const rule = report.rule_results.find(item => item.rule_id === 'EOS-GOVERNANCE-001');
  assert.strictEqual(rule?.status, 'PASS');
  assert.strictEqual(report.overall_phase_status, 'GREEN');
});

test('eos.risk.yml com arquitetura declarada satisfaz o gate sem documentação local', async () => {
  const report = await auditTempProject(root => {
    writePassingPackageJson(root);
    fs.writeFileSync(path.join(root, 'eos.risk.yml'), 'architecture:\n  profile: layered-application\n');
  });

  const rule = report.rule_results.find(item => item.rule_id === 'EOS-GOVERNANCE-001');
  assert.strictEqual(rule?.status, 'PASS');
  assert.match(rule?.rationale ?? '', /declara arquitetura\/claims/i);
});
