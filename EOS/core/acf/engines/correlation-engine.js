/**
 * EOS ACF Engine — Correlation Engine
 * 
 * Executa o Modelo 2: Correlação baseando-se no SemanticGraph global.
 * Estabelece relações estruturais (DependencyEstablished) a partir das conexões
 * e consultas semânticas no grafo de conhecimento.
 */

const ACFFacts = require('../domain/facts');

class CorrelationEngine {
  /**
   * @param {import('../adapter-registry')} adapterRegistry
   */
  constructor(adapterRegistry) {
    this.registry = adapterRegistry;
  }

  /**
   * Conecta as referências com as respectivas definições de artefatos.
   * 
   * @param {import('../../platform/semantic-graph')} semanticGraph
   * @param {import('../../platform/execution-context')} context
   * @returns {import('../../domain/fact')[]} Fatos de dependência estruturada
   */
  execute(semanticGraph, context) {
    console.log('[ACF Engine] Iniciando Modelo 2: Correlação...');
    const dependencyFacts = [];

    // Obter todas as referências carregadas no Grafo Semântico
    const edges = semanticGraph.getAllEdges();

    // Indexar artefatos conhecidos por ID e por Nome lógico para lookup rápido
    const artifactMap = new Map();     // id -> node
    const artifactByName = new Map();  // name -> node[]

    semanticGraph.getAllNodes().forEach(node => {
      if (node.type !== 'unknown_artifact') {
        artifactMap.set(node.id, node);
        
        if (!artifactByName.has(node.id)) {
          artifactByName.set(node.id, []);
        }
        artifactByName.get(node.id).push(node);

        if (node.attributes && node.attributes.name) {
          const name = node.attributes.name;
          if (!artifactByName.has(name)) {
            artifactByName.set(name, []);
          }
          artifactByName.get(name).push(node);
        }
      }
    });

    edges.forEach(edge => {
      const fromId = edge.from;
      const toTarget = edge.to;

      // 1. Verificação por ID direto no grafo
      if (artifactMap.has(toTarget)) {
        dependencyFacts.push(ACFFacts.dependencyEstablished('correlation-engine', {
          from: fromId,
          to: toTarget,
          type: edge.type
        }));
      } 
      // 2. Verificação por Nome lógico (ex: classe CSS, component name)
      else if (artifactByName.has(toTarget)) {
        const targetNodes = artifactByName.get(toTarget);
        targetNodes.forEach(targetNode => {
          dependencyFacts.push(ACFFacts.dependencyEstablished('correlation-engine', {
            from: fromId,
            to: targetNode.id,
            type: edge.type
          }));
        });
      }
    });

    // 3. Executar lógica específica do adaptador se aplicável (retrocompatibilidade)
    const inventoryFacts = []; // Para adaptadores legados que esperavam fatos brutos
    semanticGraph.getAllNodes().forEach(node => {
      if (node.type !== 'unknown_artifact') {
        inventoryFacts.push({
          metric: 'acf.artifact.identified',
          source: node.attributes.source || 'adapter',
          metadata: { id: node.id, name: node.attributes.name, type: node.type, path: node.attributes.path }
        });
      }
    });

    this.registry.getAll().forEach(adapter => {
      try {
        const adapterDeps = adapter.correlate(inventoryFacts, context);
        adapterDeps.forEach(dep => {
          if (dep.metric === 'acf.dependency.established') {
            dependencyFacts.push(dep);
          }
        });
      } catch (err) {
        console.error(`[-] Falha na correlação específica do adaptador [${adapter.getName()}]: ${err.message}`);
      }
    });

    console.log(`[ACF Engine] [Correlação] Grafo construído com ${dependencyFacts.length} dependências.`);
    return dependencyFacts;
  }
}

module.exports = CorrelationEngine;
