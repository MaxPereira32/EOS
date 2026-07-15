/**
 * EOS ACF Engine — Metrics Engine
 * 
 * Calcula métricas numéricas agregadas do ACF a partir de fatos estruturados coletados
 * e diagnosticados. Essas métricas são compatíveis com o sistema de métricas do EOS,
 * servindo de entrada para o motor de regras globais (RuleEngine).
 */

const Metric = require('../../domain/metric');

class ACFMetricsEngine {
  /**
   * Calcula métricas agregadas do ACF a partir de todos os fatos gerados no ciclo.
   * 
   * @param {import('../../domain/fact')[]} acfFacts
   * @returns {import('../../domain/metric')[]} Lista de Métricas EOS
   */
  calculate(acfFacts) {
    console.log('[ACF Engine] Calculando métricas derivadas do ACF v1.0.0...');

    let totalArtifacts = 0;
    let totalReferences = 0;
    let totalDependencies = 0;
    let totalInconsistencies = 0;
    let brokenReferencesCount = 0;
    let orphansCount = 0;
    let namingInconsistenciesCount = 0;
    let duplicationCount = 0;

    let totalComplexity = 0;
    let totalCoupling = 0;
    let totalCohesion = 0;
    let complexityCount = 0;
    let reusedCount = 0;

    acfFacts.forEach(fact => {
      if (fact.metric === 'acf.artifact.identified') {
        totalArtifacts++;
      } else if (fact.metric === 'acf.reference.found') {
        totalReferences++;
      } else if (fact.metric === 'acf.dependency.established') {
        totalDependencies++;
      } else if (fact.metric === 'acf.inconsistency.detected') {
        totalInconsistencies++;
        const type = fact.metadata.type;
        if (type === 'broken_reference') {
          brokenReferencesCount++;
        } else if (type === 'orphan_artifact') {
          orphansCount++;
        } else if (type === 'naming_inconsistency') {
          namingInconsistenciesCount++;
        } else if (type === 'duplication') {
          duplicationCount++;
        }
      } else if (fact.metric === 'acf.complexity.analyzed') {
        complexityCount++;
        totalComplexity += fact.metadata.complexityIndex || 0;
        totalCoupling += fact.metadata.couplingIndex || 0;
        totalCohesion += fact.metadata.cohesionIndex || 0;
        if (fact.metadata.reusedTimes > 0) reusedCount++;
      }
    });

    // Cálculos de Indicadores requeridos pela Fase 11
    const artifactConsistencyScore = Math.max(0, 100 - ((brokenReferencesCount * 15) + (namingInconsistenciesCount * 5) + (orphansCount * 2)));
    const architecturalIntegrity = Math.max(0, 100 - (brokenReferencesCount * 20));
    const reuseIndex = totalArtifacts > 0 ? Math.round((reusedCount / totalArtifacts) * 100) : 0;
    
    const complexityIndex = complexityCount > 0 ? Math.round(totalComplexity / complexityCount) : 10;
    const couplingIndex = complexityCount > 0 ? Math.round(totalCoupling / complexityCount) : 0;
    const cohesionIndex = complexityCount > 0 ? Math.round(totalCohesion / complexityCount) : 100;
    
    const policyCompliance = totalInconsistencies === 0 ? 100 : Math.max(0, 100 - (totalInconsistencies * 8));
    const regressionRisk = brokenReferencesCount > 0 ? 75 : (totalInconsistencies > 5 ? 40 : 10);

    console.log(`[ACF Engine] [Métricas] Score de Consistência: ${artifactConsistencyScore}/100, Integridade: ${architecturalIntegrity}/100`);

    return [
      new Metric('acf.totalArtifacts', totalArtifacts, 'contagem de artefatos identificados'),
      new Metric('acf.totalReferences', totalReferences, 'contagem de referências encontradas'),
      new Metric('acf.totalDependencies', totalDependencies, 'contagem de dependências estabelecidas no grafo'),
      new Metric('acf.totalInconsistencies', totalInconsistencies, 'soma de todas as inconsistências'),
      new Metric('acf.brokenReferences', brokenReferencesCount, 'contagem de referências para elementos ausentes'),
      new Metric('acf.orphans', orphansCount, 'contagem de artefatos não referenciados (órfãos)'),
      new Metric('acf.namingInconsistencies', namingInconsistenciesCount, 'contagem de violações de nomenclatura'),
      new Metric('acf.consistencyScore', artifactConsistencyScore, '100 - penalidades por inconsistência'),
      
      // Novos Indicadores da Fase 11
      new Metric('acf.architecturalIntegrity', architecturalIntegrity, 'Indica o nível de integridade arquitetônica'),
      new Metric('acf.reuseIndex', reuseIndex, 'Percentual de componentes reutilizados'),
      new Metric('acf.complexityIndex', complexityIndex, 'Índice médio de complexidade dos artefatos'),
      new Metric('acf.couplingIndex', couplingIndex, 'Índice médio de acoplamento dos artefatos'),
      new Metric('acf.cohesionIndex', cohesionIndex, 'Índice médio de coesão dos artefatos'),
      new Metric('acf.structuralDuplication', duplicationCount, 'Contagem de estruturas duplicadas'),
      new Metric('acf.policyCompliance', policyCompliance, 'Conformidade com as políticas declaradas'),
      new Metric('acf.regressionRisk', regressionRisk, 'Grau de risco de regressão arquitetônica')
    ];
  }
}

module.exports = ACFMetricsEngine;
