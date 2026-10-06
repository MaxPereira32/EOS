import { EvidenceEnvelope, GateResult, GateStatus } from '../domain/universal-contracts';
import { SecurityClaimEvaluation } from '../domain/types';

export class HardQualityGateEngine {

  /**
   * Avaliação de Hard Quality Gates Invioláveis (NIST SSDF PO.1.1 / Fail-Closed).
   * O único componente com autoridade para conceder GREEN.
   * Pontuações numéricas (Score) JAMAIS podem sobrescrever violações deste gate.
   */
  public evaluateHardGates(
    securityClaims: readonly SecurityClaimEvaluation[] = [],
    envelopes: readonly EvidenceEnvelope[] = [],
    governorIntegrityValid: boolean = true,
    traditionalScore: number = 100
  ): GateResult {
    const hardViolations: string[] = [];

    // 1. Integridade do Governador
    if (!governorIntegrityValid) {
      hardViolations.push('[GOVERNANCE TAMPERING DETECTED] A integridade do core do EOS foi violada ou adulterada.');
    }

    // 2. Avaliação de Envelopes de Evidência Universais
    for (const env of envelopes) {
      if (env.is_simulation_only || env.state === 'SIMULATION_ONLY') {
        hardViolations.push(`[HARD GATE BLOCK] Claim ${env.claimId}: Evidência baseada unicamente em SIMULATION_ONLY.`);
      }

      if (env.state === 'ARTIFACT_MISMATCH') {
        hardViolations.push(`[HARD GATE BLOCK] Claim ${env.claimId}: Mismatch de Artefato (SHA-256 do artefato executado difere do auditado).`);
      }

      if (env.state === 'PROVENANCE_INVALID') {
        hardViolations.push(`[HARD GATE BLOCK] Claim ${env.claimId}: Providência de Evidência Inválida.`);
      }

      if (env.state === 'CAUSALITY_FAILED') {
        hardViolations.push(`[HARD GATE BLOCK] Claim ${env.claimId}: Falha de Causalidade (Kill Ratio insuficiente ou simulador desconectado).`);
      }

      if (env.state === 'TOOLING_FAILURE') {
        hardViolations.push(`[HARD GATE BLOCK] Claim ${env.claimId}: Falha Crítica de Ferramental de Teste / Subprocesso.`);
      }

      if (env.blocking_reasons && env.blocking_reasons.length > 0) {
        env.blocking_reasons.forEach(reason => {
          hardViolations.push(`[HARD GATE BLOCK] Claim ${env.claimId}: ${reason}`);
        });
      }
    }

    // 3. Compatibilidade com Claims de Segurança Legados
    for (const claim of securityClaims) {
      if (claim.evidence && claim.evidence.is_simulation_only) {
        hardViolations.push(`[HARD GATE BLOCK] Legacy Claim ${claim.claim_id}: Evidência de simulação em JS/TS puras.`);
      }

      if (claim.blocking_reasons && claim.blocking_reasons.length > 0) {
        claim.blocking_reasons.forEach(r => {
          if (!hardViolations.includes(`[HARD GATE BLOCK] ${r}`)) {
            hardViolations.push(`[HARD GATE BLOCK] ${r}`);
          }
        });
      }
    }

    const hasHardViolations = hardViolations.length > 0;
    const hasUnprovenSecurityClaims = securityClaims.some(claim => !claim.proven);
    const canGrantGreen = !hasHardViolations && !hasUnprovenSecurityClaims && traditionalScore >= 90;
    const canGrantProven = !hasHardViolations && (envelopes.length > 0 ? envelopes.every(e => e.state === 'SECURITY_PROVEN' || e.state === 'CAUSALLY_VALIDATED') : securityClaims.every(c => c.proven));

    let overallPhaseStatus: GateStatus = 'GREEN';
    if (hasHardViolations) {
      overallPhaseStatus = 'BLOCKED';
    } else if (traditionalScore < 90 || hasUnprovenSecurityClaims) {
      overallPhaseStatus = 'YELLOW';
    }

    return {
      overall_phase_status: overallPhaseStatus,
      can_grant_green: canGrantGreen,
      can_grant_proven: canGrantProven,
      hard_violations: hardViolations
    };
  }
}
