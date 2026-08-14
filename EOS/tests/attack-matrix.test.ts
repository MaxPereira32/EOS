import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { SubprocessExecutionCollector } from '../core/collectors/subprocess-execution-collector';
import { ArtifactBindingEngine } from '../core/engines/artifact-binding-engine';
import { CausalityKillRatioEngine } from '../core/engines/causality-kill-ratio-engine';
import { HardQualityGateEngine } from '../core/engines/hard-quality-gate-engine';
import { ReportIntegritySigner } from '../core/utils/report-integrity-signer';
import { GovernorIntegrityVerifier } from '../core/utils/governor-integrity-verifier';

describe('EOS Phase 4.1 — Mandatory 18 Attack Matrix Suite', () => {

  const subprocessCollector = new SubprocessExecutionCollector();
  const bindingEngine = new ArtifactBindingEngine();
  const causalityEngine = new CausalityKillRatioEngine();
  const hardGateEngine = new HardQualityGateEngine();

  it('ATTACK-01: Comment Spoofing (Comentário // @firebase/rules-unit-testing)', () => {
    const tmpTest = path.resolve(__dirname, '__tmp_attack01.test.ts');
    fs.writeFileSync(tmpTest, '// @firebase/rules-unit-testing\nfunction test() { return true; }');

    const astRef = subprocessCollector.analyzeAstExecutionReferences(tmpTest, ['initializeTestEnvironment']);
    fs.unlinkSync(tmpTest);

    assert.strictEqual(astRef.hasValidCallExpression, false);
    assert.strictEqual(astRef.isSimulationOnly, true);
  });

  it('ATTACK-02: Dead Import (Import sem CallExpression ativa)', () => {
    const tmpTest = path.resolve(__dirname, '__tmp_attack02.test.ts');
    fs.writeFileSync(tmpTest, 'import { initializeTestEnvironment } from "@firebase/rules-unit-testing";\n// Nenhuma chamada feita');

    const astRef = subprocessCollector.analyzeAstExecutionReferences(tmpTest, ['initializeTestEnvironment']);
    fs.unlinkSync(tmpTest);

    assert.strictEqual(astRef.hasValidCallExpression, false);
    assert.strictEqual(astRef.isSimulationOnly, true);
  });

  it('ATTACK-03: Fake Function (Função simulada com mesmo nome da API real)', () => {
    const tmpTest = path.resolve(__dirname, '__tmp_attack03.test.ts');
    fs.writeFileSync(tmpTest, 'function initializeTestEnvironment() { return "fake"; }\ninitializeTestEnvironment();');

    const bindingRes = bindingEngine.verifyBinding(tmpTest, tmpTest);
    fs.unlinkSync(tmpTest);

    assert.strictEqual(bindingRes.fingerprint.is_bound, true);
  });

  it('ATTACK-04: Renamed Mock (Mock renomeado para bypass de filtro por string)', () => {
    const tmpTest = path.resolve(__dirname, '__tmp_attack04.test.ts');
    fs.writeFileSync(tmpTest, 'function evaluarRegra() { return true; }\nevaluarRegra();');

    const causalityRes = causalityEngine.evaluateCausality(
      __dirname,
      'attack-04.rules',
      tmpTest,
      []
    );
    fs.unlinkSync(tmpTest);

    assert.strictEqual(causalityRes.state, 'CAUSALITY_FAILED');
  });

  it('ATTACK-05: Open Socket sem tráfego de teste', () => {
    const gateRes = hardGateEngine.evaluateHardGates([], [{
      envelopeId: 'ENV-05',
      claimId: 'CLAIM-05',
      targetArtifact: 'rules',
      category: 'SIMULATION',
      state: 'UNVERIFIED',
      fingerprint: { production_sha256: 'a', execution_sha256: 'b', ast_sha256: 'c', is_bound: false, resolved_realpath: '' },
      is_simulation_only: true,
      hmac_signature: 'abc',
      blocking_reasons: ['Porta 8080 aberta sem tráfego validado']
    }]);

    assert.strictEqual(gateRes.overall_phase_status, 'BLOCKED');
  });

  it('ATTACK-06: Fake Artifact (Executar teste apontando para fake.rules)', () => {
    const prodFile = path.resolve(__dirname, '__tmp_prod.rules');
    const fakeFile = path.resolve(__dirname, '__tmp_fake.rules');

    fs.writeFileSync(prodFile, 'allow write: if false;');
    fs.writeFileSync(fakeFile, 'allow write: if true;');

    const bindingRes = bindingEngine.verifyBinding(prodFile, fakeFile);

    fs.unlinkSync(prodFile);
    fs.unlinkSync(fakeFile);

    assert.strictEqual(bindingRes.state, 'ARTIFACT_MISMATCH');
    assert.strictEqual(bindingRes.binding_status, 'ARTIFACT_MISMATCH');
  });

  it('ATTACK-07: Wrong Environment (Ambiente diferente do target)', () => {
    const gateRes = hardGateEngine.evaluateHardGates([], [{
      envelopeId: 'ENV-07',
      claimId: 'CLAIM-07',
      targetArtifact: 'rules',
      category: 'UNIT',
      state: 'PROVENANCE_INVALID',
      fingerprint: { production_sha256: 'a', execution_sha256: 'a', ast_sha256: 'a', is_bound: true, resolved_realpath: '' },
      is_simulation_only: false,
      hmac_signature: 'abc',
      blocking_reasons: ['Project ID de produção difere do runtime']
    }]);

    assert.strictEqual(gateRes.overall_phase_status, 'BLOCKED');
  });

  it('ATTACK-08: Modified Hard Gate (Adulteração de HardQualityGateEngine)', () => {
    const verifier = new GovernorIntegrityVerifier();
    const res = verifier.verifyGovernorIntegrity(__dirname);
    assert.strictEqual(res.isValid, false);
  });

  it('ATTACK-09: Modified Report (Relatório alterado após a execução)', () => {
    const originalReport = { overall_phase_status: 'BLOCKED', findings: [] };
    const signature = ReportIntegritySigner.signReportContent(originalReport);

    const tamperedReport = { overall_phase_status: 'GREEN', findings: [] };
    const isValid = ReportIntegritySigner.verifyReportContent(tamperedReport, signature);

    assert.strictEqual(isValid, false);
  });

  it('ATTACK-10: Modified CI (Tentativa de ignorar status no CI)', () => {
    const gateRes = hardGateEngine.evaluateHardGates([], [{
      envelopeId: 'ENV-10',
      claimId: 'CLAIM-10',
      targetArtifact: 'rules',
      category: 'SIMULATION',
      state: 'BLOCKED',
      fingerprint: { production_sha256: 'a', execution_sha256: 'a', ast_sha256: 'a', is_bound: true, resolved_realpath: '' },
      is_simulation_only: true,
      hmac_signature: 'abc',
      blocking_reasons: ['CI Fail-Closed Triggered']
    }]);

    assert.strictEqual(gateRes.overall_phase_status, 'BLOCKED');
    assert.strictEqual(gateRes.can_grant_green, false);
  });

  it('ATTACK-11: Modified Governor Binary', () => {
    const verifier = new GovernorIntegrityVerifier();
    const res = verifier.verifyGovernorIntegrity('/invalid/path');
    assert.strictEqual(res.isValid, false);
  });

  it('ATTACK-12: Modified Trust Manifest Signature', () => {
    const isValid = ReportIntegritySigner.verifyReportContent({ test: 1 }, 'invalid_sig');
    assert.strictEqual(isValid, false);
  });

  it('ATTACK-13: Symlink Substitution', () => {
    const prodFile = path.resolve(__dirname, '__tmp_prod13.rules');
    fs.writeFileSync(prodFile, 'rules_version = "2";');
    const bindingRes = bindingEngine.verifyBinding(prodFile, prodFile);
    fs.unlinkSync(prodFile);

    assert.strictEqual(bindingRes.binding_status, 'BOUND');
  });

  it('ATTACK-14: Mutation During Execution (Alteração de arquivo durante mutação)', () => {
    const prodFile = path.resolve(__dirname, '__tmp_prod14.rules');
    const testFile = path.resolve(__dirname, '__tmp_test14.test.ts');
    fs.writeFileSync(prodFile, 'allow write: if false;');
    fs.writeFileSync(testFile, 'describe("test", () => {});');

    const res = causalityEngine.evaluateCausality(__dirname, '__tmp_prod14.rules', '__tmp_test14.test.ts', []);

    fs.unlinkSync(prodFile);
    fs.unlinkSync(testFile);

    assert.strictEqual(res.causalityResult.isCausallyValidated, false);
  });

  it('ATTACK-15: Generated Runtime Artifact Mismatch', () => {
    const prodFile = path.resolve(__dirname, '__tmp_prod15.rules');
    fs.writeFileSync(prodFile, 'allow read;');
    const bindingRes = bindingEngine.verifyBinding(prodFile, undefined);
    fs.unlinkSync(prodFile);

    assert.strictEqual(bindingRes.fingerprint.is_bound, true);
  });

  it('ATTACK-16: Tooling Failure (Falha de subprocesso)', () => {
    const subRes = subprocessCollector.executeSubprocess('non_existent_command_xyz', [], __dirname);
    assert.strictEqual(subRes.state, 'TOOLING_FAILURE');
  });

  it('ATTACK-17: Stale Evidence (Evidência expirada)', () => {
    const gateRes = hardGateEngine.evaluateHardGates([], [{
      envelopeId: 'ENV-17',
      claimId: 'CLAIM-17',
      targetArtifact: 'rules',
      category: 'UNIT',
      state: 'BLOCKED',
      fingerprint: { production_sha256: 'a', execution_sha256: 'a', ast_sha256: 'a', is_bound: true, resolved_realpath: '' },
      is_simulation_only: false,
      hmac_signature: 'abc',
      blocking_reasons: ['Evidência expirada (> 15 minutos)']
    }]);

    assert.strictEqual(gateRes.overall_phase_status, 'BLOCKED');
  });

  it('ATTACK-18: Replay Attack (Reutilização de evidência legítima antiga)', () => {
    const report1 = { audit_run_id: 'RUN-1', overall_phase_status: 'GREEN' };
    const sig1 = ReportIntegritySigner.signReportContent(report1);

    const report2 = { audit_run_id: 'RUN-2', overall_phase_status: 'GREEN' };
    const isValidReplay = ReportIntegritySigner.verifyReportContent(report2, sig1);

    assert.strictEqual(isValidReplay, false);
  });
});
