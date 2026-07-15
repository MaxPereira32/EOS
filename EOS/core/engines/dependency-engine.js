/**
 * EOS Engine — Dependency Engine (v0.8)
 * 
 * Analisa o SemanticGraph e o Knowledge Model estruturados na plataforma
 * em busca de acoplamentos indesejados, dependências cruzadas entre domínios e violações
 * de topologia (ex: dependências circulares).
 */

const ACFFacts = require('../acf/domain/facts');

class DependencyEngine {
  /**
   * Avalia acoplamentos arquiteturais e de domínio no Grafo Semântico.
   * 
   * @param {import('../platform/semantic-graph')} semanticGraph
   * @param {object} config - Configurações extraídas do auditoria.json
   * @returns {import('../domain/fact')[]} Lista de Fatos InconsistencyDetected
   */
  evaluate(semanticGraph, config = {}) {
    console.log('[Dependency Engine] Iniciando análise de acoplamentos estruturais...');
    const violations = [];
    const depConfig = config.dependency_engine || {};
    const forbiddenCouplings = depConfig.forbidden_couplings || []; // ex: [{ from: "faturamento", to: "vendas" }]

    // 1. Detectar dependências circulares de arquivos (ciclos) no Grafo
    const cycles = semanticGraph.findCycles();
    cycles.forEach((cycle, idx) => {
      violations.push(ACFFacts.inconsistencyDetected('dependency-engine', {
        inconsistencyId: `INC-DEP-CYC-${idx.toString().padStart(3, '0')}`,
        type: 'circular_dependency',
        description: `Acoplamento circular detectado entre componentes: ${cycle.join(' ──> ')}.`,
        severity: 'high',
        artifactsAffected: cycle,
        confidenceScore: 0.99,
        details: { cycle }
      }));
    });

    // 2. Mapeamento de Domínios para busca de acoplamentos ilegais de negócio (Knowledge Graph)
    // Para cada nó do tipo 'domain', encontramos quais arquivos/artefatos pertencem a ele.
    // Primeiro, resolvemos o domínio de cada artefato.
    const artifactToDomain = new Map(); // file -> domainId
    const artifactToFeature = new Map(); // file -> featureId

    const features = semanticGraph.queryNodes(n => n.type === 'feature');
    features.forEach(feat => {
      const domainEdge = semanticGraph.getConnectedEdges(feat.id, 'out').find(e => e.type === 'belongs_to');
      const domainId = domainEdge ? domainEdge.to : null;

      // Pegar todas as arestas que entram nesta feature (arquivos que belongs_to a feature)
      const fileEdges = semanticGraph.getConnectedEdges(feat.id, 'in').filter(e => e.type === 'belongs_to');
      fileEdges.forEach(edge => {
        artifactToFeature.set(edge.from, feat.id);
        if (domainId) {
          artifactToDomain.set(edge.from, domainId);
        }
      });
    });

    // Analisar acoplamentos proibidos entre domínios
    if (forbiddenCouplings.length > 0) {
      const edges = semanticGraph.getAllEdges().filter(e => e.type === 'css_class_usage' || e.type === 'style_sheet_import' || e.type === 'established');
      
      edges.forEach((edge, idx) => {
        const fromDomain = artifactToDomain.get(edge.from);
        const toDomain = artifactToDomain.get(edge.to);

        if (fromDomain && toDomain && fromDomain !== toDomain) {
          // Verificar se esta relação de domínio é proibida
          const violationRule = forbiddenCouplings.find(r => r.from === fromDomain && r.to === toDomain);
          if (violationRule) {
            violations.push(ACFFacts.inconsistencyDetected('dependency-engine', {
              inconsistencyId: `INC-DEP-CPL-${idx.toString().padStart(3, '0')}`,
              type: 'forbidden_domain_coupling',
              description: `Acoplamento proibido de domínio de negócio: "${edge.from}" (Domínio: ${fromDomain}) depende de "${edge.to}" (Domínio: ${toDomain}).`,
              severity: 'critical',
              artifactsAffected: [edge.from, edge.to],
              confidenceScore: 0.95,
              details: {
                fromDomain,
                toDomain,
                fromFile: edge.from,
                toFile: edge.to
              }
            }));
          }
        }
      });
    }

    console.log(`[Dependency Engine] Análise finalizada. ${violations.length} violações de acoplamento detectadas.`);
    return violations;
  }
}

module.exports = DependencyEngine;
