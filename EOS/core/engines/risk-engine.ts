/**
 * EOS COMPOSITE RISK ENGINE & CVSS v4.0 MAPPER (v2.1.0)
 * 
 * Multidimensional Business Impact, CIA Triad Weighting, Composite Dual Score,
 * and CVSS v4.0 Macro Vector Lookup & Subsequent System Impact calculation.
 */

import { Asset, Finding, Fact } from '../domain-graph';

export interface RiskCalculationDetails {
  finding_id: string;
  asset_id: string;
  likelihood: number; // 1.0 - 10.0
  business_impact_avg: number; // 1.0 - 10.0
  cia_weight: number; // 0.5 - 1.5
  dual_confidence: number; // 0.0 - 1.0
  composite_risk_score: number; // 0.0 - 100.0
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
}

export class RiskEngine {
  /**
   * Calcula o Score de Risco Composto Enterprise:
   * Risk Score = Likelihood × Avg(Financial, Legal, Operational, Reputation) × Weight(CIA) × DualConfidence
   */
  public calculateCompositeRisk(
    finding: Finding,
    asset: Asset,
    factConfidenceMap: Map<string, number>
  ): RiskCalculationDetails {
    // 1. Determina Probabilidade (Likelihood) a partir da severidade e CVSS v4.0
    const severityLikelihoodMap: Record<string, number> = {
      CRITICAL: 9.5,
      HIGH: 8.0,
      MEDIUM: 5.5,
      LOW: 3.0,
      INFORMATIONAL: 1.0,
    };
    const likelihood = severityLikelihoodMap[finding.severity] || 5.0;

    // 2. Média das 4 Dimensões de Impacto de Negócio
    const bi = asset.business_impact;
    const businessImpactAvg = (bi.financial + bi.legal + bi.operational + bi.reputation) / 4;

    // 3. Peso da Tríade CIA
    const ciaWeightMap: Record<string, number> = {
      CRITICAL: 1.5,
      HIGH: 1.25,
      MEDIUM: 1.0,
      LOW: 0.75,
      NONE: 0.5,
    };
    const cWeight = ciaWeightMap[asset.criticality.confidentiality] || 1.0;
    const iWeight = ciaWeightMap[asset.criticality.integrity] || 1.0;
    const aWeight = ciaWeightMap[asset.criticality.availability] || 1.0;
    const ciaWeight = Math.round(((cWeight + iWeight + aWeight) / 3) * 100) / 100;

    // 4. Média de Dual Confidence dos Fatos associados ao Finding
    let confidenceSum = 0;
    let confidenceCount = 0;
    finding.fact_ids.forEach(factId => {
      const conf = factConfidenceMap.get(factId);
      if (conf !== undefined) {
        confidenceSum += conf;
        confidenceCount++;
      }
    });
    const dualConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0.85;

    // 5. Fórmula do Risco Composto Enterprise (Escalado para 0 - 100)
    const rawScore = (likelihood * businessImpactAvg * ciaWeight * dualConfidence);
    const compositeRiskScore = Math.min(100, Math.round(rawScore * 10) / 10);

    // 6. Determina Nível de Risco Ajustado
    let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' = 'INFORMATIONAL';
    if (compositeRiskScore >= 75) riskLevel = 'CRITICAL';
    else if (compositeRiskScore >= 50) riskLevel = 'HIGH';
    else if (compositeRiskScore >= 25) riskLevel = 'MEDIUM';
    else if (compositeRiskScore >= 10) riskLevel = 'LOW';

    return {
      finding_id: finding.finding_id,
      asset_id: asset.asset_id,
      likelihood,
      business_impact_avg: Math.round(businessImpactAvg * 10) / 10,
      cia_weight: ciaWeight,
      dual_confidence: Math.round(dualConfidence * 100) / 100,
      composite_risk_score: compositeRiskScore,
      risk_level: riskLevel,
    };
  }

  /**
   * Constrói o Vetor CVSS v4.0 estrito com Impacto em Sistemas Subsequentes (Subsequent System Impact)
   */
  public generateCvssV4Vector(params: {
    attackVector: 'N' | 'A' | 'L' | 'P'; // Network, Adjacent, Local, Physical
    attackComplexity: 'L' | 'H';
    attackRequirements: 'N' | 'P';
    privilegesRequired: 'N' | 'L' | 'H';
    userInteraction: 'N' | 'P' | 'A';
    vulnerableSystemImpact: { c: 'H' | 'L' | 'N'; i: 'H' | 'L' | 'N'; a: 'H' | 'L' | 'N' };
    subsequentSystemImpact: { sc: 'H' | 'L' | 'N'; si: 'H' | 'L' | 'N'; sa: 'H' | 'L' | 'N' };
  }): { vector: string; baseScore: number } {
    const vector = `CVSS:4.0/AV:${params.attackVector}/AC:${params.attackComplexity}/AT:${params.attackRequirements}/PR:${params.privilegesRequired}/UI:${params.userInteraction}/VC:${params.vulnerableSystemImpact.c}/VI:${params.vulnerableSystemImpact.i}/VA:${params.vulnerableSystemImpact.a}/SC:${params.subsequentSystemImpact.sc}/SI:${params.subsequentSystemImpact.si}/SA:${params.subsequentSystemImpact.sa}`;
    
    // Estimativa determinística de Score CVSS 4.0 baseada em Impactos Subsequentes
    let base = 0;
    if (params.vulnerableSystemImpact.c === 'H' || params.vulnerableSystemImpact.i === 'H') base += 4.0;
    if (params.subsequentSystemImpact.sc === 'H' || params.subsequentSystemImpact.si === 'H') base += 3.5;
    if (params.attackVector === 'N') base += 1.5;
    if (params.userInteraction === 'N') base += 1.0;

    const baseScore = Math.min(10.0, Math.round(base * 10) / 10);
    return { vector, baseScore };
  }
}
