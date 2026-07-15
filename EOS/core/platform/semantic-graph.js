/**
 * EOS Platform — Semantic Graph
 * 
 * Grafo semântico compartilhado que organiza fatos brutos e normalizados em
 * uma base de conhecimento estruturada em nós e arestas relacionais.
 * Permite consultas semânticas, caminhos de dependência e detecção de anomalias.
 */

class SemanticGraph {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, attributes }
    this.edges = [];        // { from, to, type, properties }
    this.adjacencyList = new Map(); // id -> Set of edges
  }

  /**
   * Adiciona um nó ao grafo.
   * @param {string} id - ID único do nó
   * @param {string} type - Tipo de entidade (ex: component, style, file, package)
   * @param {object} [attributes] - Atributos adicionais da entidade
   * @returns {SemanticGraph}
   */
  addNode(id, type, attributes = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('[SemanticGraph] Nó deve possuir um ID do tipo string.');
    }
    if (!type || typeof type !== 'string') {
      throw new Error('[SemanticGraph] Nó deve possuir um tipo estruturado.');
    }

    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, type, attributes: attributes || {} });
      this.adjacencyList.set(id, new Set());
    } else {
      // Mesclar atributos se o nó já existia (ex: coletado por mais de uma fonte)
      const existing = this.nodes.get(id);
      if (existing.type === 'unknown_artifact' && type !== 'unknown_artifact') {
        existing.type = type;
      }
      existing.attributes = Object.assign({}, existing.attributes, attributes);
    }
    return this;
  }

  /**
   * Adiciona uma aresta direcionada ao grafo relacionando dois nós.
   * @param {string} from - ID do nó de origem
   * @param {string} to - ID do nó de destino
   * @param {string} type - Tipo de relação (ex: imports, uses_class, depends_on)
   * @param {object} [properties] - Propriedades adicionais da relação
   * @returns {SemanticGraph}
   */
  addEdge(from, to, type, properties = {}) {
    if (!from || !to || !type) {
      throw new Error('[SemanticGraph] Aresta exige origem (from), destino (to) e tipo de relação.');
    }

    // Garantir que os nós existam no grafo antes de conectá-los
    this.addNode(from, 'unknown_artifact');
    this.addNode(to, 'unknown_artifact');

    const edge = { from, to, type, properties: properties || {} };
    this.edges.push(edge);
    this.adjacencyList.get(from).add(edge);
    
    return this;
  }

  /**
   * Retorna um nó pelo seu ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getNode(id) {
    return this.nodes.get(id);
  }

  /**
   * Retorna todos os nós do grafo.
   * @returns {object[]}
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Retorna todas as arestas do grafo.
   * @returns {object[]}
   */
  getAllEdges() {
    return this.edges;
  }

  /**
   * Retorna os vizinhos de um nó em uma determinada direção.
   * @param {string} id - ID do nó
   * @param {'out'|'in'|'all'} [direction] - Direção da aresta (default: 'out')
   * @returns {object[]} Lista de arestas conectadas
   */
  getConnectedEdges(id, direction = 'out') {
    if (!this.nodes.has(id)) return [];

    if (direction === 'out') {
      return Array.from(this.adjacencyList.get(id) || []);
    }

    if (direction === 'in') {
      return this.edges.filter(edge => edge.to === id);
    }

    return this.edges.filter(edge => edge.from === id || edge.to === id);
  }

  /**
   * Busca nós que atendam a critérios flexíveis.
   * @param {Function} predicate - Função de filtragem (nó => boolean)
   * @returns {object[]}
   */
  queryNodes(predicate) {
    return this.getAllNodes().filter(predicate);
  }

  /**
   * Carrega fatos brutos do EOS e constrói o grafo automaticamente.
   * Consome fatos canônicos e do ACF para modelar os nós e arestas.
   * @param {import('../domain/fact')[]} facts
   */
  loadFacts(facts) {
    facts.forEach(fact => {
      const metadata = fact.metadata || {};

      switch (fact.metric) {
        case 'acf.artifact.identified':
          this.addNode(metadata.id, metadata.type, {
            name: metadata.name,
            path: metadata.path,
            source: fact.source,
            ...metadata.details
          });
          break;

        case 'acf.reference.found':
          // Cria uma aresta representativa do uso / importação
          this.addEdge(metadata.from, metadata.to, metadata.type, {
            source: fact.source,
            location: metadata.location
          });
          break;

        case 'acf.definition.located':
          // Vincula a localização de definição ao nó correspondente se existir
          this.addNode(metadata.artifactId, 'unknown_artifact', {
            definitionLocation: metadata.location
          });
          break;

        case 'acf.dependency.established':
          this.addEdge(metadata.from, metadata.to, metadata.type, {
            established: true,
            source: fact.source
          });
          break;
      }
    });
    return this;
  }

  /**
   * Carrega o modelo de conhecimento de features e domínios se configurado.
   * @param {object} config - Configuração de conhecimento do auditoria.json
   */
  loadKnowledgeModel(config) {
    if (!config || !config.conhecimento) return this;
    
    const conhecimento = config.conhecimento;
    
    // Processar domínios
    if (conhecimento.dominios) {
      Object.keys(conhecimento.dominios).forEach(domainId => {
        const dom = conhecimento.dominios[domainId];
        this.addNode(domainId, 'domain', { name: dom.name || domainId });
      });
    }

    // Processar features e ligá-las aos domínios
    if (conhecimento.features) {
      Object.keys(conhecimento.features).forEach(featureId => {
        const feat = conhecimento.features[featureId];
        this.addNode(featureId, 'feature', { name: feat.name || featureId });
        
        if (feat.dominio) {
          this.addEdge(featureId, feat.dominio, 'belongs_to');
        }

        // Ligar arquivos/componentes mapeados a esta feature
        if (Array.isArray(feat.arquivos)) {
          feat.arquivos.forEach(filePath => {
            this.addEdge(filePath, featureId, 'belongs_to');
          });
        }
      });
    }
    return this;
  }

  /**
   * Detecção de ciclos direcionados (utiliza busca em profundidade - DFS).
   * @returns {string[][]} Lista de ciclos encontrados (caminhos de IDs)
   */
  findCycles() {
    const visited = new Set();
    const stack = new Set();
    const cycles = [];
    const path = [];

    const dfs = (nodeId) => {
      visited.add(nodeId);
      stack.add(nodeId);
      path.push(nodeId);

      const edges = this.getConnectedEdges(nodeId, 'out');
      for (const edge of edges) {
        const neighbor = edge.to;
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (stack.has(neighbor)) {
          // Ciclo detectado: extrair a parte do caminho correspondente ao ciclo
          const cycleStartIdx = path.indexOf(neighbor);
          if (cycleStartIdx !== -1) {
            cycles.push(path.slice(cycleStartIdx).concat(neighbor));
          }
        }
      }

      stack.delete(nodeId);
      path.pop();
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }
}

module.exports = SemanticGraph;
