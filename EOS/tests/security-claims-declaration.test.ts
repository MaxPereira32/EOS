import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

test('claim ACTIVE declarado sem avaliador formal impede GREEN', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-active-claim-'));
  try {
    fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'domain', 'index.ts'), 'export const domain = true;\n');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { test: 'node -e "process.exit(0)"' }
    }));
    fs.writeFileSync(
      path.join(root, 'eos.risk.yml'),
      [
        'architecture:',
        '  domain_directory: "src/domain"',
        'security_claims:',
        '  - id: "SEC-CLAIM-UNMAPPED-001"',
        '    status: "ACTIVE"',
        '    target: "src/domain/index.ts"',
        '',
      ].join('\n'),
    );

    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const rule = report.rule_results.find(item => item.rule_id === 'EOS-SECURITY-CLAIMS-001');

    assert.strictEqual(rule?.status, 'FAIL');
    assert.match(rule?.rationale ?? '', /SEC-CLAIM-UNMAPPED-001/);
    assert.strictEqual(report.overall_phase_status, 'BLOCKED');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('claim ACTIVE com validação executável é materializado como YELLOW até prova causal', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-validated-claim-'));
  try {
    fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'domain', 'index.ts'), 'export const domain = true;\n');
    fs.writeFileSync(path.join(root, 'security.test.ts'), 'export const evidence = true;\n');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { 'security:test': 'node -e "process.exit(0)"' }
    }));
    fs.writeFileSync(
      path.join(root, 'eos.risk.yml'),
      [
        'architecture:',
        '  domain_directory: "src/domain"',
        'security_claims:',
        '  - id: "SEC-CLAIM-VALIDATED-001"',
        '    status: "ACTIVE"',
        '    target: "src/domain/index.ts"',
        '    evidence:',
        '      validation_script: "security:test"',
        '      test_suite: "security.test.ts"',
        '',
      ].join('\n'),
    );

    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const rule = report.rule_results.find(item => item.rule_id === 'EOS-SECURITY-CLAIMS-001');
    const claim = report.security_claims?.find(item => item.claim_id === 'SEC-CLAIM-VALIDATED-001');

    assert.strictEqual(rule?.status, 'PASS');
    assert.strictEqual(claim?.phase_status, 'YELLOW');
    assert.strictEqual(claim?.proven, false);
    assert.strictEqual(claim?.evidence.payload?.execution_state, 'PASS');
    assert.strictEqual(report.overall_phase_status, 'YELLOW');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('claim ACTIVE com causal_spec só vira PROVEN quando a mutação quebra a mesma validação', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-causal-claim-'));
  try {
    fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'domain', 'index.js'), 'module.exports = { domain: true };\n');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({scripts:{'security:test':'node check.js'}}));
    fs.writeFileSync(path.join(root, 'check.js'), `
const assert=require('node:assert/strict');
const emit=(type,details)=>console.log('EOS_CAUSAL_RECORD '+JSON.stringify({version:1,
nonce:process.env.EOS_CAUSAL_NONCE,phase:process.env.EOS_CAUSAL_PHASE,
claim_id:process.env.EOS_CAUSAL_CLAIM_ID,assertion_id:process.env.EOS_CAUSAL_ASSERTION_ID,type,...details}));
try{assert.equal(require('./src/domain/index.js').domain,true);emit('ASSERTION',{status:'PASS'});emit('COMPLETION',{kind:'PASS'});}
catch(error){emit('ASSERTION',{status:'FAIL'});emit('COMPLETION',{kind:'ASSERTION'});process.exitCode=1;}
`);
    fs.writeFileSync(path.join(root, 'eos.causal.json'), JSON.stringify({
      claims: {
        'SEC-CLAIM-CAUSAL-001': {
          kind: 'TEXT_REPLACE',
          target: 'src/domain/index.js',
          search: 'domain: true',
          replacement: 'domain: false',
          expected_replacements: 1,
          assertion_id: 'DOMAIN-ENABLED',
        },
      },
    }));
    fs.writeFileSync(
      path.join(root, 'eos.risk.yml'),
      [
        'architecture:',
        '  domain_directory: "src/domain"',
        'security_claims:',
        '  - id: "SEC-CLAIM-CAUSAL-001"',
        '    status: "ACTIVE"',
        '    target: "src/domain/index.js"',
        '    evidence:',
        '      validation_script: "security:test"',
        '      test_suite: "src/domain/index.js"',
        '      causal_spec: "eos.causal.json"',
        '',
      ].join('\n'),
    );

    const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));
    const claim = report.security_claims?.find(item => item.claim_id === 'SEC-CLAIM-CAUSAL-001');

    assert.strictEqual(claim?.proven, true);
    assert.strictEqual(claim?.phase_status, 'GREEN');
    assert.strictEqual(claim?.evidence.category, 'CAUSAL');
    assert.strictEqual(claim?.evidence.causality_status, 'PROVEN_CAUSAL');
    assert.strictEqual(claim?.mutation_result?.original_status, 'PASS');
    assert.strictEqual(claim?.mutation_result?.mutated_status, 'FAIL');
    assert.strictEqual(report.overall_phase_status, 'GREEN');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});