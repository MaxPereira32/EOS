import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import { GovernorIntegrityVerifier } from '../core/utils/governor-integrity-verifier';
import { HardQualityGateEngine } from '../core/engines/hard-quality-gate-engine';

describe('EOS Phase 4.1 — Self-Governance & Governor Integrity Suite', () => {

  const verifier = new GovernorIntegrityVerifier();
  const hardGateEngine = new HardQualityGateEngine();

  it('Deve aprovar a integridade dos módulos essenciais do Core do EOS', () => {
    const coreDir = path.resolve(__dirname, '../core');
    const res = verifier.verifyGovernorIntegrity(coreDir);
    assert.strictEqual(res.isValid, true);
  });

  it('Deve detectar adulteração se um módulo do Core do EOS for removido ou corrompido', () => {
    const invalidDir = path.resolve(__dirname, '../invalid_core_dir');
    const res = verifier.verifyGovernorIntegrity(invalidDir);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.rationale.includes('GOVERNANCE TAMPERING DETECTED'));
  });

  it('Deve travar o HardQualityGate em BLOCKED se a integridade do governador for violada', () => {
    const gateRes = hardGateEngine.evaluateHardGates(
      [],
      [],
      false, // governorIntegrityValid = false
      100
    );

    assert.strictEqual(gateRes.overall_phase_status, 'BLOCKED');
    assert.strictEqual(gateRes.can_grant_green, false);
    assert.ok(gateRes.hard_violations.some(v => v.includes('GOVERNANCE TAMPERING DETECTED')));
  });
});
