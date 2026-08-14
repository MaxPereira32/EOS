import { describe, it, expect } from 'vitest';
import { FirestoreSecurityEngine } from '../EOS/core/engines/firestore-security-engine';
import { CausalityMutationEngine } from '../EOS/core/engines/causality-mutation-engine';
import { HardQualityGateEngine } from '../EOS/core/engines/hard-quality-gate-engine';
import { SecurityClaimEvaluation, FormalEvidence } from '../EOS/core/domain/types';

describe('EOS Self-Governance Security Test Suite (Governor Meta-Tests)', () => {

  const secEngine = new FirestoreSecurityEngine();
  const causalityEngine = new CausalityMutationEngine();
  const hardGateEngine = new HardQualityGateEngine();

  it('CASE B: Regra correta + Teste Simulation Only deve resultar em BLOCKED', () => {
    const evidence: FormalEvidence = {
      evidence_id: 'EVD-TEST-001',
      category: 'SIMULATION',
      source_artifact: 'firestore.rules',
      test_artifact: 'src/nucleo/firebase/regrasFirestore.test.ts',
      runtime_environment: 'JS_MOCK',
      causality_status: 'UNVERIFIED',
      confidence_score: 0.3,
      source_reliability: 0.2,
      reproducible: true,
      is_simulation_only: true
    };

    const claim: SecurityClaimEvaluation = {
      claim_id: 'SEC-TEST-001',
      claim_type: 'FIRESTORE_RULES',
      target_artifact: 'firestore.rules',
      evidence,
      threat_vectors: [],
      proven: false,
      phase_status: 'BLOCKED',
      blocking_reasons: ['EVIDÊNCIA SIMULADA: O teste é SIMULATION_ONLY']
    };

    const res = hardGateEngine.evaluateHardGates([claim], 100);
    expect(res.overall_phase_status).toBe('BLOCKED');
    expect(res.can_grant_green).toBe(false);
    expect(res.can_grant_proven).toBe(false);
  });

  it('CASE C: Regra permissiva + Teste simulado deve falhar na Causalidade e resultar em BLOCKED', () => {
    const evidence: FormalEvidence = {
      evidence_id: 'EVD-TEST-002',
      category: 'SIMULATION',
      source_artifact: 'firestore.rules',
      test_artifact: 'src/nucleo/firebase/regrasFirestore.test.ts',
      runtime_environment: 'JS_MOCK',
      causality_status: 'UNVERIFIED',
      confidence_score: 0.3,
      source_reliability: 0.2,
      reproducible: true,
      is_simulation_only: true
    };

    // Avaliar causalidade via simulador
    const mutationRes = causalityEngine.evaluateCausality('.', evidence);
    expect(mutationRes.causality_proven).toBe(false);
    expect(mutationRes.rationale).toContain('FALHA CRÍTICA DE CAUSALIDADE');
  });

  it('CASE G: Score 100 com Hard Gate crítico ausente NÃO PODE conceder GREEN', () => {
    const claim: SecurityClaimEvaluation = {
      claim_id: 'SEC-TEST-003',
      claim_type: 'FIRESTORE_RULES',
      target_artifact: 'firestore.rules',
      evidence: {
        evidence_id: 'EVD-003',
        category: 'SIMULATION',
        source_artifact: 'firestore.rules',
        runtime_environment: 'JS_MOCK',
        causality_status: 'UNVERIFIED',
        confidence_score: 0.1,
        source_reliability: 0.1,
        reproducible: true,
        is_simulation_only: true
      },
      threat_vectors: [],
      proven: false,
      phase_status: 'BLOCKED',
      blocking_reasons: ['HARD GATE BLOCK: Falha de runtime']
    };

    const hardRes = hardGateEngine.evaluateHardGates([claim], 100); // Score tradicional 100/100
    expect(hardRes.overall_phase_status).toBe('BLOCKED');
    expect(hardRes.can_grant_green).toBe(false);
  });

  it('CASE H: Teste que continua passando após mutação deve ser rejeitado', () => {
    const evidence: FormalEvidence = {
      evidence_id: 'EVD-TEST-004',
      category: 'SIMULATION',
      source_artifact: 'firestore.rules',
      test_artifact: 'src/nucleo/firebase/regrasFirestore.test.ts',
      runtime_environment: 'JS_MOCK',
      causality_status: 'UNVERIFIED',
      confidence_score: 0.3,
      source_reliability: 0.2,
      reproducible: true,
      is_simulation_only: true
    };

    const mutRes = causalityEngine.evaluateCausality('.', evidence);
    expect(mutRes.causality_proven).toBe(false);
    expect(mutRes.mutated_status).toBe('PASS'); // O simulador passa mesmo com a regra quebrada
  });

});
