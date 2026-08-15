import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('EOS Phase 3.2.0 — Final Architectural Contract Integrity', () => {
  const contractPath = path.resolve(__dirname, '../docs/architecture/EOS_FINAL_ARCHITECTURAL_CONTRACT.md');

  it('C-001: Contract exists', () => {
    assert.strictEqual(fs.existsSync(contractPath), true, 'EOS_FINAL_ARCHITECTURAL_CONTRACT.md is missing');
  });

  it('C-002: Contract ID exists', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('**CONTRACT_ID**: EOS-ARCH-CONTRACT-001'), 'Must declare CONTRACT_ID');
  });

  it('C-003: Contract version exists', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('**VERSION**: 3.2.0'), 'Must declare VERSION');
  });

  it('C-004: Architectural principles are present', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('AP-001'), 'Must include AP-001');
    assert.ok(content.includes('AP-006'), 'Must include AP-006');
  });

  it('C-005: Causal chain is present', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('Observation'), 'Must define Observation');
    assert.ok(content.includes('Evidence'), 'Must define Evidence');
    assert.ok(content.includes('Finding'), 'Must define Finding');
    assert.ok(content.includes('Resolution'), 'Must define Resolution');
  });

  it('C-006: Trust Boundary is present', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('TRUSTED'), 'Must define TRUSTED boundary');
    assert.ok(content.includes('OUT OF SCOPE'), 'Must define OUT OF SCOPE boundary');
  });

  it('C-007: Self-Governance ≠ Independent Assurance is present', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(
      content.includes('SELF-GOVERNANCE ≠ INDEPENDENT ASSURANCE'),
      'Must declare SELF-GOVERNANCE ≠ INDEPENDENT ASSURANCE'
    );
  });

  it('C-008: Invariant Registry is referenced', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('EOS_INVARIANT_REGISTRY.md'), 'Must reference Invariant Registry');
  });

  it('C-009: Change Control is referenced', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('EOS_CHANGE_CONTROL.md'), 'Must reference Change Control');
  });

  it('C-010: Governance Gate is referenced', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(content.includes('npm run governance'), 'Must reference the native Governance Gate command');
  });
});
