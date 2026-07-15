/**
 * EOS Engine — Security Engine (v0.8)
 * 
 * Analisa a topologia de segurança no SemanticGraph, verificando rotas desprotegidas
 * (ausência de middlewares de autenticação/autorização) e pacotes vulneráveis declarados.
 */

const ACFFacts = require('../acf/domain/facts');

class SecurityEngine {
  /**
   * Avalia conformidade de segurança e vulnerabilidades estruturais no Grafo.
   * 
   * @param {import('../platform/semantic-graph')} semanticGraph
   * @param {object} config - Configurações de segurança do auditoria.json
   * @returns {import('../domain/fact')[]} Lista de Fatos de violações de segurança
   */
  evaluate(semanticGraph, config = {}) {
    console.log('[Security Engine] Iniciando auditoria de segurança arquitetural...');
    const violations = [];
    const secConfig = config.security_engine || {};
    const vulnerablePackages = secConfig.vulnerable_packages || {}; // ex: { "lodash": "<4.17.21" }

    // 1. Auditoria de Rotas Expostas
    // Qualquer nó do tipo 'route' (ou com nome contendo 'route' ou 'controller')
    // deve possuir pelo menos uma aresta de relação 'secured_by' ou 'uses_middleware' de autenticação.
    const routes = semanticGraph.queryNodes(n => n.type === 'route' || n.id.includes('/routes/') || n.id.includes('/controllers/'));
    
    let secIdx = 0;
    routes.forEach(route => {
      // Procurar arestas de saída que indiquem proteção de autenticação
      const edges = semanticGraph.getConnectedEdges(route.id, 'out');
      const isSecured = edges.some(e => e.type === 'secured_by' || e.type === 'uses_middleware' || e.properties.secured === true);

      if (!isSecured) {
        violations.push(ACFFacts.inconsistencyDetected('security-engine', {
          inconsistencyId: `INC-SEC-EXP-${secIdx.toString().padStart(3, '0')}`,
          type: 'unsecured_route',
          description: `Vulnerabilidade de Rota Exposta: A rota ou controller "${route.id}" não possui middleware ou anotação de autenticação ativa (secured_by).`,
          severity: 'critical',
          artifactsAffected: [route.id],
          confidenceScore: 0.95,
          details: {
            path: route.attributes.path || route.id,
            reparation: "Vincular um middleware de validação de token JWT ou sessão (secured_by) a esta rota."
          }
        }));
        secIdx++;
      }
    });

    // 2. Auditoria de Dependências de Pacotes Vulneráveis
    const packages = semanticGraph.queryNodes(n => n.type === 'package');
    packages.forEach((pkg, idx) => {
      const name = pkg.id; // nome do pacote
      const version = pkg.attributes.version;

      if (vulnerablePackages[name]) {
        // Simulação simples de comparação de versão vulnerável
        violations.push(ACFFacts.inconsistencyDetected('security-engine', {
          inconsistencyId: `INC-SEC-PKG-${idx.toString().padStart(3, '0')}`,
          type: 'vulnerable_dependency',
          description: `Vulnerabilidade de Terceiros: O pacote dependente "${name}@${version}" possui falha de segurança conhecida na versão atual.`,
          severity: 'high',
          artifactsAffected: [pkg.id],
          confidenceScore: 0.99,
          details: {
            package: name,
            currentVersion: version,
            fixVersion: vulnerablePackages[name]
          }
        }));
      }
    });

    console.log(`[Security Engine] Auditoria finalizada. ${violations.length} problemas de segurança detectados.`);
    return violations;
  }
}

module.exports = SecurityEngine;
