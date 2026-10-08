import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

test('claim IDOR é classificado como IDOR e só vira PROVEN quando a mutação quebra a autorização', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-idor-claim-'));
  try {
    fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'domain', 'index.js'), 'module.exports = { ownerGuard: true };\n');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { 'security:test': 'node check-idor.js' }
    }));
    fs.writeFileSync(path.join(root, 'check-idor.js'), `
const assert = require('node:assert/strict');
const emit = (type, details) => console.log('EOS_CAUSAL_RECORD ' + JSON.stringify({ version: 1,
  nonce: process.env.EOS_CAUSAL_NONCE, phase: process.env.EOS_CAUSAL_PHASE,
  claim_id: process.env.EOS_CAUSAL_CLAIM_ID, assertion_id: process.env.EOS_CAUSAL_ASSERTION_ID, type, ...details }));
try {
  assert.equal(require('./src/domain/index.js').ownerGuard, true);
  emit('ASSERTION', { status: 'PASS' });
  emit('COMPLETION', { kind: 'PASS' });
} catch {
  emit('ASSERTION', { status: 'FAIL' });
  emit('COMPLETION', { kind: 'ASSERTION' });
  process.exitCode = 1;
}
`);
    fs.writeFileSync(path.join(root, 'eos.causal.json'), JSON.stringify({ claims: {
      'SEC-IDOR-001': {
        kind: 'TEXT_REPLACE',
        target: 'src/domain/index.js',
        search: 'ownerGuard: true',
        replacement: 'ownerGuard: false',
        expected_replacements: 1,
        assertion_id: 'IDOR-OWNER-CHECK',
      },
    } }));
    fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
      'architecture:',
      '  domain_directory: "src/domain"',
      'security_claims:',
      '  - id: "SEC-IDOR-001"',
      '    type: "IDOR"',
      '    status: "ACTIVE"',
      '    target: "src/domain/index.js"',
      '    evidence:',
      '      validation_script: "security:test"',
      '      causal_spec: "eos.causal.json"',
      '',
    ].join('\n'));

    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const claim = report.security_claims?.find(item => item.claim_id === 'SEC-IDOR-001');

    assert.strictEqual(claim?.claim_type, 'IDOR');
    assert.strictEqual(claim?.proven, true);
    assert.strictEqual(claim?.phase_status, 'GREEN');
    assert.strictEqual(claim?.evidence.causality_status, 'PROVEN_CAUSAL');
    assert.strictEqual(claim?.evidence.is_simulation_only, false);
    assert.strictEqual(report.overall_phase_status, 'GREEN');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
