import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { RuleCatalog } from '../core/rules/rule-catalog';

test('catálogo resolve as regras estáticas do motor de apps geradas com taxonomia completa', () => {
  const requiredRuleIds = [
    'EOS-GENAI-RLS-001',
    'EOS-GENAI-RLS-002',
    'EOS-GENAI-AUTHZ-001',
    'EOS-GENAI-IDOR-001',
    'EOS-GENAI-SECRET-001',
    'EOS-GENAI-INPUT-001',
    'EOS-GENAI-UPLOAD-001',
    'EOS-GENAI-PY-OPTIONAL-WRITE-001',
    'EOS-GENAI-PY-MASSASSIGN-001',
    'EOS-GENAI-PY-UPLOAD-AUTHZ-001',
  ];

  for (const ruleId of requiredRuleIds) {
    const rule = RuleCatalog.getRule(ruleId);
    assert.ok(rule, `${ruleId} deve estar registrada no catálogo`);
    assert.match(rule?.cvss_v4_vector ?? '', /^CVSS:4\.0\//);
    assert.match(rule?.taxonomy.cwe_id ?? '', /^CWE-\d+/);
    assert.match(rule?.taxonomy.owasp_category ?? '', /^A\d{2}:2021/);
    assert.ok((rule?.taxonomy.nist_sp_800_53 ?? '').length > 0);
    assert.ok((rule?.taxonomy.mitre_attack_id ?? '').length > 0);
  }

  assert.ok(RuleCatalog.getAllRules().length >= 14);
  assert.ok(!RuleCatalog.getRule('EOS-GENAI-NAO-EXISTE-001'));
});
