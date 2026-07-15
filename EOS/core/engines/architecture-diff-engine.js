/**
 * EOS Engine — Architecture Diff Engine (v0.9)
 * 
 * Executa a comparação entre duas versões completas da arquitetura (atual vs histórico).
 * Computa o delta de nós (adicionados/removidos) e arestas de relacionamento
 * no SemanticGraph compartilhado da plataforma, gerando fatos de mutação de código.
 */

const Fact = require('../domain/fact');
const SemanticGraph = require('../platform/semantic-graph');

class ArchitectureDiffEngine {
  /**
   * Compara o Grafo Semântico atual com a linha de base histórica.
   * 
   * @param {import('../platform/semantic-graph')} currentGraph - Grafo semântico atual
   * @param {object} historicalReport - Relatório anterior carregado do auditoria.json
   * @returns {{ facts: Fact[], diff: object }} Fatos estruturados de mutação e objeto de resumo do diff
   */
  compare(currentGraph, historicalReport) {
    console.log('[Architecture Diff Engine] Iniciando análise de diferenciação arquitetônica...');
    const diffFacts = [];
    
    const diff = {
      nodesAdded: [],
      nodesRemoved: [],
      edgesAdded: [],
      edgesRemoved: []
    };

    if (!historicalReport || !historicalReport.fatos_brutos) {
      console.log('[Architecture Diff Engine] Sem linha de base histórica disponível para comparação.');
      return { facts: [], diff };
    }

    // 1. Restaurar o Grafo Semântico da linha de base anterior
    const baselineGraph = new SemanticGraph();
    try {
      baselineGraph.loadFacts(historicalReport.fatos_brutos);
      if (historicalReport.acf || historicalReport.pcf) {
        baselineGraph.loadKnowledgeModel(historicalReport.acf || historicalReport.pcf);
      }
    } catch (err) {
      console.error(`[-] Falha ao restaurar o grafo semântico do histórico: ${err.message}`);
      return { facts: [], diff };
    }

    // 2. Comparação de Nós (Nodes)
    const currentNodes = currentGraph.getAllNodes();
    const baselineNodes = baselineGraph.getAllNodes();

    const currentNodeIds = new Set(currentNodes.map(n => n.id));
    const baselineNodeIds = new Set(baselineNodes.map(n => n.id));

    // Nós Adicionados
    currentNodes.forEach(node => {
      if (!baselineNodeIds.has(node.id) && node.type !== 'unknown_artifact') {
        diff.nodesAdded.push({ id: node.id, type: node.type });
        diffFacts.push(new Fact({
          metric: 'diff.node.added',
          value: 1,
          source: 'architecture-diff-engine',
          metadata: { id: node.id, type: node.type }
        }));
      }
    });

    // Nós Removidos
    baselineNodes.forEach(node => {
      if (!currentNodeIds.has(node.id) && node.type !== 'unknown_artifact') {
        diff.nodesRemoved.push({ id: node.id, type: node.type });
        diffFacts.push(new Fact({
          metric: 'diff.node.removed',
          value: 1,
          source: 'architecture-diff-engine',
          metadata: { id: node.id, type: node.type }
        }));
      }
    });

    // 3. Comparação de Arestas (Relationships)
    const currentEdges = currentGraph.getAllEdges();
    const baselineEdges = baselineGraph.getAllEdges();

    const edgeKey = (e) => `${e.from}──[${e.type}]──>${e.to}`;
    const currentEdgeKeys = new Set(currentEdges.map(edgeKey));
    const baselineEdgeKeys = new Set(baselineEdges.map(edgeKey));

    // Arestas Adicionadas (Novas dependências criadas)
    currentEdges.forEach(edge => {
      const key = edgeKey(edge);
      if (!baselineEdgeKeys.has(key)) {
        diff.edgesAdded.push({ from: edge.from, to: edge.to, type: edge.type });
        diffFacts.push(new Fact({
          metric: 'diff.edge.added',
          value: 1,
          source: 'architecture-diff-engine',
          metadata: { from: edge.from, to: edge.to, type: edge.type }
        }));
      }
    });

    // Arestas Removidas (Dependências eliminadas)
    baselineEdges.forEach(edge => {
      const key = edgeKey(edge);
      if (!currentEdgeKeys.has(key)) {
        diff.edgesRemoved.push({ from: edge.from, to: edge.to, type: edge.type });
        diffFacts.push(new Fact({
          metric: 'diff.edge.removed',
          value: 1,
          source: 'architecture-diff-engine',
          metadata: { from: edge.from, to: edge.to, type: edge.type }
        }));
      }
    });

    console.log(`[Architecture Diff Engine] Comparação concluída: +${diff.nodesAdded.length}/-${diff.nodesRemoved.length} Nós, +${diff.edgesAdded.length}/-${diff.edgesRemoved.length} Arestas.`);
    return { facts: diffFacts, diff };
  }
}

module.exports = ArchitectureDiffEngine;
