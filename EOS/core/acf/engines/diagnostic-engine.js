/**
 * EOS ACF Engine — Diagnostic Engine
 * 
 * Executa o Modelo 3: Diagnóstico baseando-se no SemanticGraph global.
 * Identifica inconsistências estruturais (referências quebradas, elementos órfãos,
 * dependências circulares e nomenclatura fora de padrão) e calcula o grau de confiança (confidenceScore).
 */

const ACFFacts = require('../domain/facts');

class DiagnosticEngine {
  /**
   * Executa a auditoria diagnóstica no grafo semântico.
   * 
   * @param {import('../../platform/semantic-graph')} semanticGraph - O grafo semântico compartilhado
   * @param {object} policyConfig - Configurações de regras e severidades
   * @returns {import('../../domain/fact')[]} Lista de Fatos InconsistencyDetected
   */
  execute(semanticGraph, policyConfig = {}, profile = null) {
    console.log('[ACF Engine] Iniciando Modelo 3: Diagnóstico com Confidence Score...');
    const inconsistencyFacts = [];

    const severities = Object.assign({
      broken_reference: 'high',
      orphan_artifact: 'low',
      naming_inconsistency: 'medium',
      circular_dependency: 'high'
    }, policyConfig.severidades || {});

    // Verificar se o projeto usa TailwindCSS para tratar classes utilitárias
    let hasTailwind = false;
    if (profile && profile.styling && profile.styling.includes('TailwindCSS')) {
      hasTailwind = true;
    } else {
      try {
        const fs = require('fs');
        const path = require('path');
        const pkgPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          if (deps['tailwindcss']) {
            hasTailwind = true;
          }
        }
      } catch (e) {
        // Silencioso
      }
    }

    if (hasTailwind) {
      console.log('[ACF Engine] [Diagnóstico] TailwindCSS detectado. Classes CSS utilitárias serão toleradas.');
    }

    // Mapear artefatos legítimos do grafo (nós conhecidos)
    const artifacts = semanticGraph.queryNodes(node => node.type !== 'unknown_artifact');
    
    // Mapear nós desconhecidos (que foram referenciados por arestas mas não identificados como artefatos)
    const unknownNodes = semanticGraph.queryNodes(node => node.type === 'unknown_artifact');

    // 1. Diagnóstico de Referências Quebradas (Broken References)
    let brkIdx = 0;
    unknownNodes.forEach(node => {
      // Verificar se a referência foi de alguma forma resolvida para um artefato legítimo no grafo
      const resolvedArtifacts = semanticGraph.queryNodes(n => 
        n.type !== 'unknown_artifact' && 
        (
          n.id === node.id || 
          (n.attributes && n.attributes.name === node.id) ||
          n.id.replace(/\.[a-zA-Z0-9]+$/, '') === node.id ||
          (n.attributes && n.attributes.path && n.attributes.path.replace(/\.[a-zA-Z0-9]+$/, '') === node.id)
        )
      );

      if (resolvedArtifacts.length > 0) {
        // Se encontramos o artefato correspondente no grafo, não está quebrado
        return;
      }

      const inboundEdges = semanticGraph.getConnectedEdges(node.id, 'in');
      inboundEdges.forEach(edge => {
        // Se for uso de classe CSS (css_class_usage) e o projeto usa TailwindCSS, toleramos a ausência de definição estática
        if (edge.type === 'css_class_usage' && hasTailwind) {
          return;
        }

        // Se for um import direto de arquivo que não existe, confiança é 0.99. Se for classe CSS, 0.95.
        const confidenceScore = edge.type === 'style_sheet_import' ? 0.99 : 0.95;

        inconsistencyFacts.push(ACFFacts.inconsistencyDetected('diagnostic-engine', {
          inconsistencyId: `INC-BRK-${brkIdx.toString().padStart(3, '0')}`,
          type: 'broken_reference',
          description: `Referência para "${node.id}" feita por "${edge.from}" não pôde ser resolvida no grafo semântico.`,
          severity: severities.broken_reference,
          artifactsAffected: [edge.from],
          confidenceScore: confidenceScore,
          details: {
            refFrom: edge.from,
            refTo: node.id,
            location: edge.properties.location
          }
        }));
        brkIdx++;
      });
    });

    // 2. Diagnóstico de Artefatos Órfãos (Orphans)
    const skipOrphanCheck = ['index', 'main', 'app', 'App', 'index.css', 'styles.css', 'global.css'];
    let orfIdx = 0;
    artifacts.forEach(art => {
      // Apenas consideramos órfãos arquivos de estilo.
      // Classes CSS individuais e componentes React não possuem suas referências completas
      // ou são resolvidos dinamicamente, gerando falsos-positivos na análise estática estrita.
      if (art.type !== 'style') {
        return;
      }

      const inbound = semanticGraph.getConnectedEdges(art.id, 'in');
      const name = art.attributes.name;

      if (inbound.length === 0 && !skipOrphanCheck.some(skip => name.toLowerCase().includes(skip.toLowerCase()))) {
        // Confiança é 0.85, pois o artefato pode ser carregado dinamicamente por reflexão ou bundlers
        const confidenceScore = 0.85;

        inconsistencyFacts.push(ACFFacts.inconsistencyDetected('diagnostic-engine', {
          inconsistencyId: `INC-ORF-${orfIdx.toString().padStart(3, '0')}`,
          type: 'orphan_artifact',
          description: `Artefato órfão detectado: "${name}" (${art.type}) não possui dependências direcionadas para si no grafo.`,
          severity: severities.orphan_artifact,
          artifactsAffected: [art.id],
          confidenceScore: confidenceScore,
          details: {
            path: art.attributes.path,
            type: art.type
          }
        }));
        orfIdx++;
      }
    });

    // 3. Diagnóstico de Padrão de Nomenclatura (Naming Inconsistency)
    const namingPatterns = Object.assign({
      component: '^[A-Z][a-zA-Z0-9]*$',
      style: '^[a-z0-9-]+$',
      file: '^[a-z0-9.-]+$'
    }, policyConfig.nomenclatura || {});

    // Heurística de segurança contra backtracking catastrófico
    const isSafeRegex = (pattern) => {
      if (pattern.length > 150) return false;
      const dangerousPatterns = [
        /\([^)]*[*+?]\)[*+?]/,
        /\([^)]*\\w\+[^)]*\)[*+?]/,
        /\([^)]*\\d\+[^)]*\)[*+?]/,
        /\[[^\]]*\][*+?][*+?]/
      ];
      for (const dangerous of dangerousPatterns) {
        if (dangerous.test(pattern)) return false;
      }
      return true;
    };

    let namIdx = 0;
    artifacts.forEach(art => {
      const type = art.type;
      const name = art.attributes.name;

      // Ignorar verificações de nomenclatura para arquivos principais/indexadores da aplicação
      const skipNamingCheck = ['index', 'main'];
      if (name && skipNamingCheck.includes(name.toLowerCase())) {
        return;
      }

      let patternStr = namingPatterns[type] || namingPatterns.file;
      
      // Sanitização de Expressão Regular
      if (!isSafeRegex(patternStr)) {
        console.warn(`[ACF Engine] [Diagnóstico] Regex de nomenclatura potencialmente inseguro detectado: "${patternStr}". Usando padrão seguro.`);
        patternStr = '^[a-zA-Z0-9.-]+$';
      }

      const regex = new RegExp(patternStr);

      if (name && !regex.test(name)) {
        // Confiança é 0.99 pois é uma checagem regex matemática estrita
        const confidenceScore = 0.99;

        inconsistencyFacts.push(ACFFacts.inconsistencyDetected('diagnostic-engine', {
          inconsistencyId: `INC-NAM-${namIdx.toString().padStart(3, '0')}`,
          type: 'naming_inconsistency',
          description: `Artefato "${name}" (${type}) não atende à política regex de nomenclatura "${patternStr}".`,
          severity: severities.naming_inconsistency,
          artifactsAffected: [art.id],
          confidenceScore: confidenceScore,
          details: {
            path: art.attributes.path,
            pattern: patternStr
          }
        }));
        namIdx++;
      }
    });

    // 4. Diagnóstico de Dependências Circulares (Circular Dependencies)
    const cycles = semanticGraph.findCycles();
    cycles.forEach((cycle, cycIdx) => {
      // Confiança de 0.99 pois a análise de ciclos por DFS é determinística
      const confidenceScore = 0.99;

      inconsistencyFacts.push(ACFFacts.inconsistencyDetected('diagnostic-engine', {
        inconsistencyId: `INC-CYC-${cycIdx.toString().padStart(3, '0')}`,
        type: 'circular_dependency',
        description: `Dependência circular detectada no grafo semântico: ${cycle.join(' ──> ')}.`,
        severity: severities.circular_dependency,
        artifactsAffected: cycle,
        confidenceScore: confidenceScore,
        details: { cycle }
      }));
    });

    console.log(`[ACF Engine] [Diagnóstico] Auditoria finalizada. ${inconsistencyFacts.length} inconsistências detectadas.`);
    return inconsistencyFacts;
  }
}

module.exports = DiagnosticEngine;
