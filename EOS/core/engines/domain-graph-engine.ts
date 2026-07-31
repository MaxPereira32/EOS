/**
 * EOS ENTERPRISE DOMAIN GRAPH ENGINE (v2.1.0)
 * 
 * In-Memory Graph Indexing, Attack Path Traversal, Blast Radius Calculation,
 * and Fact-to-Evidence (1:N) Dual-Score Consolidation.
 */

import { Asset, Observation, Evidence, Fact, Threat, Finding, Remediation } from '../domain-graph';

export interface GraphNode {
  id: string;
  type: 'ASSET' | 'OBSERVATION' | 'EVIDENCE' | 'FACT' | 'THREAT' | 'FINDING' | 'REMEDIATION';
  data: Asset | Observation | Evidence | Fact | Threat | Finding | Remediation;
  neighbors: Set<string>; // Outgoing adjacency list
}

export interface AttackPath {
  path_id: string;
  source_asset_id: string;
  target_asset_id: string;
  hops: string[];
  cumulative_risk_weight: number;
}

export interface BlastRadiusResult {
  root_asset_id: string;
  affected_assets: Array<{
    asset_id: string;
    asset_name: string;
    criticality_score: number;
    distance: number;
  }>;
  total_blast_score: number;
}

export class DomainGraphEngine {
  private nodes: Map<string, GraphNode> = new Map();
  private assetMap: Map<string, Asset> = new Map();
  private observationMap: Map<string, Observation> = new Map();
  private evidenceMap: Map<string, Evidence> = new Map();
  private factMap: Map<string, Fact> = new Map();
  private threatMap: Map<string, Threat> = new Map();
  private findingMap: Map<string, Finding> = new Map();
  private remediationMap: Map<string, Remediation> = new Map();

  // Relacionamentos Inversos
  private factToEvidences: Map<string, Set<string>> = new Map();
  private assetToFacts: Map<string, Set<string>> = new Map();
  private assetToThreats: Map<string, Set<string>> = new Map();

  /**
   * Registra um Ativo no Grafo
   */
  public addAsset(asset: Asset): void {
    this.assetMap.set(asset.asset_id, asset);
    this.nodes.set(asset.asset_id, {
      id: asset.asset_id,
      type: 'ASSET',
      data: asset,
      neighbors: new Set(),
    });
  }

  /**
   * Registra uma Observação no Grafo e conecta ao Ativo
   */
  public addObservation(observation: Observation): void {
    this.observationMap.set(observation.observation_id, observation);
    this.nodes.set(observation.observation_id, {
      id: observation.observation_id,
      type: 'OBSERVATION',
      data: observation,
      neighbors: new Set(),
    });

    // Conecta Asset -> Observation
    const assetNode = this.nodes.get(observation.asset_id);
    if (assetNode) {
      assetNode.neighbors.add(observation.observation_id);
    }
  }

  /**
   * Registra uma Evidência no Grafo e conecta à Observação
   */
  public addEvidence(evidence: Evidence): void {
    this.evidenceMap.set(evidence.evidence_id, evidence);
    this.nodes.set(evidence.evidence_id, {
      id: evidence.evidence_id,
      type: 'EVIDENCE',
      data: evidence,
      neighbors: new Set(),
    });

    // Conecta Observation -> Evidence
    const obsNode = this.nodes.get(evidence.observation_id);
    if (obsNode) {
      obsNode.neighbors.add(evidence.evidence_id);
    }
  }

  /**
   * Consolida Fatos sustentados por 1:N Evidências (Inversão Racional)
   */
  public addFact(fact: Fact): void {
    this.factMap.set(fact.fact_id, fact);
    this.nodes.set(fact.fact_id, {
      id: fact.fact_id,
      type: 'FACT',
      data: fact,
      neighbors: new Set(fact.evidence_ids),
    });

    this.factToEvidences.set(fact.fact_id, new Set(fact.evidence_ids));

    // Conecta Evidências ao Fato
    fact.evidence_ids.forEach((evId) => {
      const evNode = this.nodes.get(evId);
      if (evNode) {
        evNode.neighbors.add(fact.fact_id);
      }
    });

    // Mapeia Asset -> Fact
    if (!this.assetToFacts.has(fact.asset_id)) {
      this.assetToFacts.set(fact.asset_id, new Set());
    }
    this.assetToFacts.get(fact.asset_id)!.add(fact.fact_id);
  }

  /**
   * Registra Ameaça e conecta com Fatos e Ativos
   */
  public addThreat(threat: Threat): void {
    this.threatMap.set(threat.threat_id, threat);
    this.nodes.set(threat.threat_id, {
      id: threat.threat_id,
      type: 'THREAT',
      data: threat,
      neighbors: new Set(threat.fact_ids),
    });

    if (!this.assetToThreats.has(threat.asset_id)) {
      this.assetToThreats.set(threat.asset_id, new Set());
    }
    this.assetToThreats.get(threat.asset_id)!.add(threat.threat_id);
  }

  /**
   * Registra Achado (Finding)
   */
  public addFinding(finding: Finding): void {
    this.findingMap.set(finding.finding_id, finding);
    this.nodes.set(finding.finding_id, {
      id: finding.finding_id,
      type: 'FINDING',
      data: finding,
      neighbors: new Set(finding.fact_ids),
    });
  }

  /**
   * Registra Remediação
   */
  public addRemediation(remediation: Remediation): void {
    this.remediationMap.set(remediation.fix_id, remediation);
    this.nodes.set(remediation.fix_id, {
      id: remediation.fix_id,
      type: 'REMEDIATION',
      data: remediation,
      neighbors: new Set([remediation.finding_id]),
    });
  }

  /**
   * Calcula a Pontuação Composta de Confiabilidade (Dual Score) para um Fato
   * Composite Confidence = Confidence × Source Reliability (Média das Evidências)
   */
  public getFactCompositeConfidence(factId: string): { composite_confidence: number; evidence_count: number } {
    const fact = this.factMap.get(factId);
    if (!fact || fact.evidence_ids.length === 0) {
      return { composite_confidence: 0.5, evidence_count: 0 };
    }

    let totalScore = 0;
    let validEvidences = 0;

    fact.evidence_ids.forEach((evId) => {
      const ev = this.evidenceMap.get(evId);
      if (ev) {
        // Dual score: Precisão do Padrão * Confiabilidade Histórica da Fonte
        const dualScore = ev.confidence * ev.source_reliability;
        totalScore += dualScore;
        validEvidences++;
      }
    });

    const averageDualScore = validEvidences > 0 ? totalScore / validEvidences : 0.5;
    return {
      composite_confidence: Math.round(averageDualScore * 1000) / 1000,
      evidence_count: validEvidences,
    };
  }

  /**
   * Calcula o Raio de Impacto (Blast Radius) de um Ativo comprometido
   */
  public calculateBlastRadius(rootAssetId: string, maxDepth: number = 3): BlastRadiusResult {
    const rootAsset = this.assetMap.get(rootAssetId);
    if (!rootAsset) {
      return { root_asset_id: rootAssetId, affected_assets: [], total_blast_score: 0 };
    }

    const visited = new Set<string>();
    const queue: Array<{ assetId: string; distance: number }> = [{ assetId: rootAssetId, distance: 0 }];
    const affectedAssets: Array<{ asset_id: string; asset_name: string; criticality_score: number; distance: number }> = [];

    let totalBlastScore = 0;

    while (queue.length > 0) {
      const { assetId, distance } = queue.shift()!;

      if (visited.has(assetId) || distance > maxDepth) continue;
      visited.add(assetId);

      const asset = this.assetMap.get(assetId);
      if (asset) {
        const ciaWeight = this.getAssetCiaScore(asset);
        const businessScore = (asset.business_impact.financial + asset.business_impact.legal + asset.business_impact.operational + asset.business_impact.reputation) / 4;
        const criticalityScore = Math.round((ciaWeight * businessScore) * 10) / 10;

        if (assetId !== rootAssetId) {
          affectedAssets.push({
            asset_id: asset.asset_id,
            asset_name: asset.name,
            criticality_score: criticalityScore,
            distance,
          });
          totalBlastScore += criticalityScore / distance;
        }

        // Busca vizinhos no grafo
        const node = this.nodes.get(assetId);
        if (node) {
          node.neighbors.forEach((neighborId) => {
            if (!visited.has(neighborId)) {
              queue.push({ assetId: neighborId, distance: distance + 1 });
            }
          });
        }
      }
    }

    return {
      root_asset_id: rootAssetId,
      affected_assets: affectedAssets,
      total_blast_score: Math.round(totalBlastScore * 100) / 100,
    };
  }

  /**
   * Converte a Tríade CIA em peso numérico
   */
  public getAssetCiaScore(asset: Asset): number {
    const levelMap: Record<string, number> = {
      CRITICAL: 1.5,
      HIGH: 1.25,
      MEDIUM: 1.0,
      LOW: 0.75,
      NONE: 0.5,
    };

    const c = levelMap[asset.criticality.confidentiality] || 1.0;
    const i = levelMap[asset.criticality.integrity] || 1.0;
    const a = levelMap[asset.criticality.availability] || 1.0;

    return Math.round(((c + i + a) / 3) * 100) / 100;
  }

  /**
   * Retorna contadores e estatísticas do Grafo de Domínio
   */
  public getStats() {
    return {
      total_assets: this.assetMap.size,
      total_observations: this.observationMap.size,
      total_evidences: this.evidenceMap.size,
      total_facts: this.factMap.size,
      total_threats: this.threatMap.size,
      total_findings: this.findingMap.size,
      total_remediations: this.remediationMap.size,
    };
  }

  // Getters para os mapas de dados
  public getAssets(): Asset[] { return Array.from(this.assetMap.values()); }
  public getObservations(): Observation[] { return Array.from(this.observationMap.values()); }
  public getEvidences(): Evidence[] { return Array.from(this.evidenceMap.values()); }
  public getFacts(): Fact[] { return Array.from(this.factMap.values()); }
  public getThreats(): Threat[] { return Array.from(this.threatMap.values()); }
  public getFindings(): Finding[] { return Array.from(this.findingMap.values()); }
  public getRemediations(): Remediation[] { return Array.from(this.remediationMap.values()); }
}
