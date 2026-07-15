/**
 * EOS ACF Engine — Complexity Engine
 * 
 * Executa a Fase 6: Análise de Complexidade Estrutural.
 * Avalia de forma agnóstica a complexidade, acoplamento e reusabilidade de cada artefato
 * com base na topologia e conectividade (grau de entrada/saída) no Grafo Semântico.
 */

const ACFFacts = require('../domain/facts');

class ComplexityEngine {
  /**
   * Executa a Fase 6: Análise de Complexidade Estrutural.
   * 
   * @param {import('../../platform/semantic-graph')} semanticGraph
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')[]} Lista de Fatos complexityAnalyzed
   */
  execute(semanticGraph, context) {
    console.log('[ACF Engine] Iniciando Fase 6: Análise de Complexidade Estrutural...');
    const facts = [];

    // Obter todos os nós do grafo
    const nodes = semanticGraph.nodes; 
    
    // Iterar pelos nós que representam artefatos físicos
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (node.type !== 'artifact') continue;

      // Calcular acoplamento (out-degree) e reutilização (in-degree)
      const outgoingEdges = semanticGraph.edges.filter(edge => edge.from === nodeId);
      const incomingEdges = semanticGraph.edges.filter(edge => edge.to === nodeId);

      const outDegree = outgoingEdges.length;
      const inDegree = incomingEdges.length;

      // Computar complexidade estrutural genérica
      let complexityIndex = 10; // complexidade base
      const factors = [];

      // Fator 1: Excesso de dependências (Acoplamento de saída)
      if (outDegree > 5) {
        const penalty = Math.min(outDegree * 8, 40);
        complexityIndex += penalty;
        factors.push(`Acoplamento elevado: dependência direta de ${outDegree} artefatos.`);
      }

      // Fator 2: Baixa Reutilização / Possível Componente Órfão
      if (inDegree === 0) {
        // Verificar se é uma página/layout ou arquivo principal.
        const isEntry = nodeId.toLowerCase().includes('page') || 
                        nodeId.toLowerCase().includes('layout') || 
                        nodeId.toLowerCase().includes('main') || 
                        nodeId.toLowerCase().includes('index') ||
                        (node.details && (node.details.isPage || node.details.isLayout));
        if (!isEntry) {
          complexityIndex += 15;
          factors.push('Baixa reutilização: artefato isolado sem referências de consumo.');
        }
      } else if (inDegree > 8) {
        factors.push(`Alta reusabilidade: consumido por ${inDegree} artefatos do projeto.`);
      }

      // Fator 3: Tamanho/Complexidade interna se detalhes disponíveis
      if (node.details && node.details.linesCount) {
        const lines = node.details.linesCount;
        if (lines > 300) {
          complexityIndex += 25;
          factors.push(`Tamanho excessivo: arquivo com ${lines} linhas de código.`);
        } else if (lines > 150) {
          complexityIndex += 10;
          factors.push(`Tamanho moderado: arquivo com ${lines} linhas de código.`);
        }
      }

      // Limitar a complexidade máxima a 100
      complexityIndex = Math.min(Math.round(complexityIndex), 100);

      // Calcular Cohesion e Coupling Index simplificados de 0 a 100
      const couplingIndex = Math.min(outDegree * 15, 100);
      const cohesionIndex = Math.max(100 - (factors.length * 15), 20);

      facts.push(ACFFacts.complexityAnalyzed('complexity-engine', {
        artifactId: nodeId,
        complexityIndex: complexityIndex,
        couplingIndex: couplingIndex,
        cohesionIndex: cohesionIndex,
        reusedTimes: inDegree,
        factors: factors
      }));
    }

    console.log(`[ACF Engine] [Complexidade] Análise finalizada. Avaliados ${facts.length} artefatos.`);
    return facts;
  }
}

module.exports = ComplexityEngine;
