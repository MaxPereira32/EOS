import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { MandatoryDirectoryRule } from '../core/rules/mandatory-directory-rule';
import { AuditTarget, Fact } from '../core/domain/types';

const target: AuditTarget = {
  target_id: 'TGT-ARCH-APPLICABILITY',
  root_path: '.',
  repository: null,
  commit_hash: null,
  branch: null,
  metadata: {},
};

function absenceFact(directory = 'src/domain'): Fact {
  return {
    fact_id: 'FCT-FS-ABSENT',
    schema_version: '1.0',
    fact_type: 'FILE_STRUCTURE',
    provider_id: 'test',
    provider_version: '1.0.0',
    evidence_ids: ['EVD-1'],
    input_hash: 'hash-input',
    semantic_hash: 'hash-semantic',
    lifecycle_status: 'VALID',
    payload: {
      fact_type: 'FILE_STRUCTURE',
      directory,
      naming_convention: 'clean-architecture-domain',
      status: 'ABSENCE_VERIFIED',
    },
    composite_confidence: 1.0,
    created_at: new Date().toISOString(),
  };
}

describe('MandatoryDirectoryRule applicability', () => {
  it('não cria finding quando domínio não se aplica', () => {
    const rule = new MandatoryDirectoryRule('src/domain', 'NOT_APPLICABLE');
    const result = rule.evaluate([absenceFact()], target);

    assert.strictEqual(result.evaluation.status, 'NOT_APPLICABLE');
    assert.strictEqual(result.finding, undefined);
  });

  it('não reprova ausência quando domínio é apenas opcional', () => {
    const rule = new MandatoryDirectoryRule('src/domain', 'OPTIONAL');
    const result = rule.evaluate([absenceFact()], target);

    assert.strictEqual(result.evaluation.status, 'NOT_APPLICABLE');
    assert.strictEqual(result.finding, undefined);
  });

  it('reprova ausência quando domínio foi declarado obrigatório', () => {
    const rule = new MandatoryDirectoryRule('src/domain', 'REQUIRED');
    const result = rule.evaluate([absenceFact()], target);

    assert.strictEqual(result.evaluation.status, 'FAIL');
    assert.ok(result.finding);
    assert.strictEqual(result.finding?.severity, 'HIGH');
  });
});
