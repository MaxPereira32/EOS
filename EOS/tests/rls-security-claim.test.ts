import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

function createRlsFixture(options: { control?: string; enabled?: boolean } = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-rls-claim-'));
  const control = options.control || 'RLS_POLICY';
  const policy = options.enabled === false
    ? 'ALTER TABLE documents DISABLE ROW LEVEL SECURITY;\n'
    : 'ALTER TABLE documents ENABLE ROW LEVEL SECURITY;\nALTER TABLE documents FORCE ROW LEVEL SECURITY;\nCREATE POLICY tenant_isolation ON documents USING (tenant_id = current_setting(\'app.tenant\'));\n';
  fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
  fs.mkdirSync(path.join(root, 'db'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'domain', 'index.ts'), 'export const domain = true;\n');
  fs.writeFileSync(path.join(root, 'db', 'policies.sql'), policy);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'test:rls': 'node rls-check.js' } }));
  fs.writeFileSync(path.join(root, 'rls-check.js'), `
const crypto = require('node:crypto');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const policy = fs.readFileSync('./db/policies.sql');
const enabled = policy.includes('ENABLE ROW LEVEL SECURITY');
const hash = crypto.createHash('sha256').update(policy).digest('hex');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const emitRls = (scenario, details) => console.log('EOS_RLS_RECORD ' + JSON.stringify({
  version: 1, claim_id: process.env.EOS_RLS_CLAIM_ID, nonce: process.env.EOS_RLS_NONCE,
  scenario, status: 'PASS', runtime: 'POSTGRES', resource: 'documents', target_sha256: hash, ...details
}));
if (process.env.EOS_RLS_NONCE) {
  emitRls('PRETEST_RLS_CONFIGURATION', { rls_enabled: enabled, rls_forced: enabled, policy_count: enabled ? 1 : 0,
    role_is_owner: false, role_has_bypassrls: false, security_definer_bypass: false });
  emitRls('ALLOW_SAME_TENANT', { actor_identity_sha256: digest('actor-a'), actor_tenant_sha256: digest('tenant-a'),
    resource_tenant_sha256: digest('tenant-a'), operations: ['SELECT','INSERT','UPDATE','DELETE'] });
  emitRls('DENY_CROSS_TENANT', { actor_identity_sha256: digest('actor-a'), actor_tenant_sha256: digest('tenant-a'),
    resource_tenant_sha256: digest('tenant-b'), operations: ['SELECT','INSERT','UPDATE','DELETE'] });
}
if (process.env.EOS_CAUSAL_VERIFICATION) {
  const emit = (type, details) => console.log('EOS_CAUSAL_RECORD ' + JSON.stringify({ version: 1,
    nonce: process.env.EOS_CAUSAL_NONCE, phase: process.env.EOS_CAUSAL_PHASE,
    claim_id: process.env.EOS_CAUSAL_CLAIM_ID, assertion_id: process.env.EOS_CAUSAL_ASSERTION_ID, type, ...details }));
  try { assert.equal(enabled, true); emit('ASSERTION', { status: 'PASS' }); emit('COMPLETION', { kind: 'PASS' }); }
  catch { emit('ASSERTION', { status: 'FAIL' }); emit('COMPLETION', { kind: 'ASSERTION' }); process.exitCode = 1; }
}
`);
  fs.writeFileSync(path.join(root, 'eos.causal.json'), JSON.stringify({ claims: {
    'SEC-CLAIM-RLS-001': {
      kind: 'TEXT_REPLACE', control, target: 'db/policies.sql',
      search: 'ENABLE ROW LEVEL SECURITY', replacement: 'DISABLE ROW LEVEL SECURITY', expected_replacements: 1,
      assertion_id: 'RLS-ISOLATION-ENFORCED',
    },
  } }));
  fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
    'architecture:', '  domain_directory: "src/domain"', 'security_claims:',
    '  - id: "SEC-CLAIM-RLS-001"', '    type: "RLS"', '    status: "ACTIVE"', '    target: "db/policies.sql"',
    '    evidence:', '      validation_script: "test:rls"', '      causal_spec: "eos.causal.json"',
    '      rls_resource: "documents"', '      rls_isolation_assertion_id: "RLS-ISOLATION-ENFORCED"', '',
  ].join('\n'));
  return root;
}

test('claim RLS só fica GREEN após pré-teste, cenários entre tenants e mutação de política', async () => {
  const root = createRlsFixture();
  try {
    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const claim = report.security_claims?.find(item => item.claim_id === 'SEC-CLAIM-RLS-001');
    const execution = report.execution_evidences?.find(item => item.rls_claim_id === 'SEC-CLAIM-RLS-001');
    const causalEvidence = claim?.mutation_result?.validation_evidence as
      | {
        baseline?: { exit_code?: number | null; command_line?: string; stdout_sha256?: string; output_excerpt?: string };
        mutant?: { exit_code?: number | null; command_line?: string; stderr_sha256?: string; output_excerpt?: string };
      }
      | undefined;
    assert.equal(claim?.claim_type, 'RLS');
    assert.equal(claim?.proven, true);
    assert.equal(claim?.phase_status, 'GREEN');
    assert.equal(claim?.mutation_result?.causality_proven, true);
    assert.equal(causalEvidence?.baseline?.exit_code, 0);
    assert.equal(causalEvidence?.mutant?.exit_code, 1);
    assert.equal(causalEvidence?.baseline?.command_line, 'npm run test:rls');
    assert.match(causalEvidence?.baseline?.stdout_sha256 || '', /^[a-f0-9]{64}$/);
    assert.match(causalEvidence?.mutant?.stderr_sha256 || '', /^[a-f0-9]{64}$/);
    assert.ok(causalEvidence?.baseline?.output_excerpt);
    assert.ok(causalEvidence?.mutant?.output_excerpt);
    assert.equal(execution?.rls_records?.length, 3);
    assert.equal(report.overall_phase_status, 'GREEN');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('registros de cenário sem mutação declarada de política RLS ficam BLOCKED', async () => {
  const root = createRlsFixture({ control: 'GENERIC_CONTROL' });
  try {
    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const claim = report.security_claims?.find(item => item.claim_id === 'SEC-CLAIM-RLS-001');
    assert.equal(claim?.proven, false);
    assert.equal(claim?.phase_status, 'BLOCKED');
    assert.match(claim?.blocking_reasons.join(' ') || '', /RLS_POLICY/);
    assert.equal(report.overall_phase_status, 'BLOCKED');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('RLS desabilitado no pré-teste fica BLOCKED mesmo com saída de cenário', async () => {
  const root = createRlsFixture({ enabled: false });
  try {
    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const claim = report.security_claims?.find(item => item.claim_id === 'SEC-CLAIM-RLS-001');
    assert.equal(claim?.proven, false);
    assert.equal(claim?.phase_status, 'BLOCKED');
    assert.match(claim?.blocking_reasons.join(' ') || '', /Pré-teste RLS/);
    assert.equal(report.overall_phase_status, 'BLOCKED');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
