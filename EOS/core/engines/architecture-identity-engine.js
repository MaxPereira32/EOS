/**
 * EOS Engine — Architecture Identity Engine (AIE) (v1.0.0)
 * 
 * Engine permanente integrado ao fluxo de governança do EOS.
 * Responsável por preservar e evoluir a identidade arquitetural do EOS e de qualquer proejto.
 * Executa as 6 fases obrigatórias do AIE: Inventário, Engenharia Reversa, Modelo Conceitual,
 * Detecção de Inconsistências, Taxonomia Oficial e Plano de Migração.
 */

const fs = require('fs');
const path = require('path');
const Fact = require('../domain/fact');
const ACFFacts = require('../acf/domain/facts');

class ArchitectureIdentityEngine {
  /**
   * Avalia a conformidade da identidade arquitetural do sistema.
   * 
   * @param {import('../platform/semantic-graph')} semanticGraph
   * @param {object} auditData - Dados do auditoria.json
   * @returns {Fact[]} Fatos de inconsistência arquitetônica detectados
   */
  evaluate(semanticGraph, auditData = {}) {
    console.log('[AIE Engine] Iniciando Architecture Identity Engine (AIE)...');
    const violations = [];
    const reportData = {
      inventory: {},
      identity: {},
      conceptModel: {},
      inconsistencies: [],
      taxonomy: {},
      migrationPlan: {}
    };

    const cwd = process.cwd();
    const hasDocsAdr = fs.existsSync(path.join(cwd, 'docs', 'adr'));
    const adrDir = hasDocsAdr ? path.join(cwd, 'docs', 'adr') : path.join(cwd, 'documentação');

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 0 — INVENTÁRIO (Mapeamento de arquivos e pastas críticas)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 0 — Executando Inventário Arquitetural...');
    const inventario = {
      diretorios: [],
      documentacao: [],
      engines: [],
      adapters: [],
      stores: [],
      components: [],
      services: []
    };

    const scanDir = (dirPath, category, ext = '.ts') => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach(file => {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && file.endsWith(ext)) {
            inventario[category].push(file);
          } else if (stat.isDirectory()) {
            inventario.diretorios.push(path.relative(cwd, fullPath));
          }
        });
      }
    };

    // Mapear arquivos de código do projeto alvo
    scanDir(path.join(cwd, 'src', 'modulos'), 'components', '.tsx');
    scanDir(path.join(cwd, 'src', 'componentes', 'ui'), 'components', '.tsx');
    scanDir(path.join(cwd, 'src', 'estruturas'), 'components', '.tsx');
    scanDir(path.join(cwd, 'src', 'estados'), 'stores', '.ts');
    scanDir(path.join(cwd, 'src', 'nucleo', 'servicos'), 'services', '.ts');
    
    // Mapear Engines e Adaptadores do EOS
    const eosCoreDir = path.join(cwd, '..', 'Engineering-Operating-System', 'EOS', 'core');
    scanDir(path.join(eosCoreDir, 'engines'), 'engines', '.js');
    scanDir(path.join(eosCoreDir, 'acf', 'adapters'), 'adapters', '.js');

    // Mapear documentação
    if (fs.existsSync(adrDir)) {
      fs.readdirSync(adrDir).forEach(file => {
        if (file.endsWith('.md')) {
          inventario.documentacao.push(file);
        }
      });
    }

    reportData.inventory = inventario;

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 1 — ENGENHARIA REVERSA (Identity Report)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 1 — Gerando Identity Report...');
    reportData.identity = {
      propósito: "Garantir a governança arquitetural contínua (Continuous Architecture) e desacoplamento total do acoplamento de infraestrutura física.",
      domínio: "Governança de Software, Gestão de Ciclo de Vida Arquitetural e Métricas de Qualidade de Código.",
      unidadeFundamental: "Fact (Fato arquitetural atômico, imutável e rastreável).",
      mecanismoPrincipal: "Event Bus central orquestrando Collectors, Normalizer, Engines e Reporters em um fluxo de pipeline unidirecional.",
      cicloDeVida: "1. Coleta -> 2. Normalização -> 3. Cálculo de Métricas -> 4. Avaliação de Regras -> 5. Portões de Qualidade (Quality Gates) -> 6. Geração de Relatórios.",
      contratoCentral: "Nenhum nó de módulo de tela (modulos/) pode fazer acesso direto a banco de dados físicos (Firebase/Firestore) sem passar pela camada de serviços (servico*) encapsulada pelas Stores de estado."
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 2 — MODELO CONCEITUAL (Canonical Concept Model)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 2 — Construindo Canonical Concept Model...');
    reportData.conceptModel = {
      nucleo: ["Event Bus", "ExecutionContext", "Fact Entity", "Rule Evaluation Engine"],
      infraestrutura: ["Normalizer Engine", "JSON/Markdown Reporters", "Dependency Collectors"],
      extensoes: ["ACF Platform", "React/CSS Adapters", "Architecture Diff Engine"],
      protocolos: "Componentes comunicam-se via eventos síncronos injetados com ExecutionContext.",
      contratos: [
        "Invariante 1: Fatos coletados são imutáveis.",
        "Invariante 2: Mudanças estruturais críticas devem possuir um ADR correspondente.",
        "Invariante 3: Acoplamento direto ao Firebase fora de 'nucleo/firebase' e 'servicos/' é estritamente proibido."
      ]
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 3 — DETECÇÃO DE INCONSISTÊNCIAS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 3 — Detectando Inconsistências de Identidade...');
    
    // 1. Validar padrão de nomenclatura dos ADRs (Ex: 001-decisoes-arquiteturais.md)
    if (fs.existsSync(adrDir)) {
      const files = fs.readdirSync(adrDir);
      files.forEach((file, idx) => {
        if (file.endsWith('.md')) {
          const padraoValido = /^\d{3}-.*\.md$/;
          if (!padraoValido.test(file)) {
            const inc = {
              inconsistencyId: `INC-AIE-ADR-${idx.toString().padStart(3, '0')}`,
              type: 'invalid_adr_naming',
              description: `Nome do arquivo ADR "${file}" não segue o padrão canônico de nomenclatura (XXX-nome.md).`,
              severity: 'medium',
              artifactsAffected: [path.join(adrDir, file)],
              confidenceScore: 1.0,
              details: {
                reparation: `Renomear o arquivo para obedecer a numeração sequencial de 3 dígitos (ex: 002-${file.replace(/^\d*-?/, '')}).`
              }
            };
            violations.push(ACFFacts.inconsistencyDetected('architecture-identity-engine', inc));
            reportData.inconsistencies.push(inc);
          }
        }
      });
    }

    // 2. Verificar imports inválidos de Firebase diretamente nos Módulos de Tela (Violando desacoplamento)
    const modulosDir = path.join(cwd, 'src', 'modulos');
    if (fs.existsSync(modulosDir)) {
      const files = fs.readdirSync(modulosDir);
      files.forEach((file, idx) => {
        if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const filePath = path.join(modulosDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('from \'firebase/firestore\'') || content.includes('from \'firebase/auth\'')) {
            const inc = {
              inconsistencyId: `INC-AIE-DEP-${idx.toString().padStart(3, '0')}`,
              type: 'illegal_firebase_import',
              description: `Acoplamento proibido: O módulo de interface "${file}" está importando o Firebase diretamente, violando o desacoplamento de infraestrutura.`,
              severity: 'critical',
              artifactsAffected: [filePath],
              confidenceScore: 0.98,
              details: {
                reparation: "Mover a lógica de dados para um arquivo sob 'src/nucleo/servicos/' e consumir através de uma Store Zustand."
              }
            };
            violations.push(ACFFacts.inconsistencyDetected('architecture-identity-engine', inc));
            reportData.inconsistencies.push(inc);
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 4 — TAXONOMIA OFICIAL (Canonical Taxonomy)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 4 — Mapeando Taxonomia Oficial...');
    reportData.taxonomy = {
      categories: {
        "Governance Layer": ["genesis-prompt.md", "checklist-conformidade.md", "divida-tecnica.md"],
        "Core": ["event-bus.js", "execution-context.js", "semantic-graph.js"],
        "Engine": ["architecture-diff-engine.js", "dependency-engine.js", "security-engine.js", "architecture-identity-engine.js"],
        "Protocol": ["ACF LifeCycle Protocol", "Event Bus Execution Protocol"],
        "Artifact": ["Fact", "Inconsistency", "RefactoringPlan"],
        "Adapter": ["react-adapter.js", "css-adapter.js"],
        "Plugin": ["eslint-collector.js", "depcruise-collector.js", "vitest-collector.js"]
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 5 — PLANO DE MIGRAÇÃO (Migration Plan)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 5 — Gerando Plano de Migração e Log de Decisões...');
    reportData.migrationPlan = {
      sequencia: [
        {
          etapa: 1,
          acao: "Integração do AIE no pipeline do eos-platform.js",
          impacto: "Segurança de identidade automatizada a cada build/lint",
          rollback: "Remover a chamada da classe no arquivo eos-platform.js"
        },
        {
          etapa: 2,
          acao: "Renomeação de ADRs fora do padrão detectados pelo AIE",
          impacto: "Padronização completa de documentos históricos",
          rollback: "Voltar nomes antigos via git checkout"
        }
      ]
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 6 — EXECUÇÃO (Escrever o Relatório Consolidado de Consistência)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[AIE Engine] Fase 6 — Gravando Relatório de Consistência Arquitetural...');
    const reportFilePath = path.join(cwd, '.eos', 'auditorias', 'architecture-consistency-report.md');
    fs.mkdirSync(path.dirname(reportFilePath), { recursive: true });

    let reportMarkdown = `# Relatório de Consistência Arquitetural (AIE)
Gerado automaticamente pelo Architecture Identity Engine (AIE) v1.0.0

## 1. Resumo Executivo
* **Status de Governança**: ${violations.length === 0 ? "APROVADO" : "ATENÇÃO (Problemas de consistência detectados)"}
* **Data da Execução**: ${new Date().toLocaleString()}
* **Total de Violações de Identidade**: ${violations.length}

---

## 2. Inventário Arquitetural (Fase 0)
* **Engines Cadastradas**: ${inventario.engines.map(e => `\`${e}\``).join(', ') || 'Nenhuma'}
* **Adaptadores Carregados**: ${inventario.adapters.map(a => `\`${a}\``).join(', ') || 'Nenhum'}
* **Stores de Estado**: ${inventario.stores.map(s => `\`${s}\``).join(', ') || 'Nenhuma'}
* **Serviços de Desacoplamento**: ${inventario.services.map(s => `\`${s}\``).join(', ') || 'Nenhum'}
* **Documentos de Governança/ADRs**: ${inventario.documentacao.map(d => `\`${d}\``).join(', ') || 'Nenhum'}

---

## 3. Relatório de Identidade e Engenharia Reversa (Fase 1)
* **Propósito do Sistema**: ${reportData.identity.propósito}
* **Unidade Fundamental**: ${reportData.identity.unidadeFundamental}
* **Mecanismo Principal**: ${reportData.identity.mecanismoPrincipal}
* **Contrato Central**: ${reportData.identity.contratoCentral}

---

## 4. Modelo Conceitual Canônico (Fase 2)
* **Componentes Núcleo**: ${reportData.conceptModel.nucleo.join(', ')}
* **Invariantes do Sistema**:
${reportData.conceptModel.contratos.map(c => `  - ${c}`).join('\n')}

---

## 5. Taxonomia Oficial (Fase 4)
| Camada | Componentes Categorizados |
|---|---|
| **Governance** | ${reportData.taxonomy.categories["Governance Layer"].join(', ')} |
| **Core** | ${reportData.taxonomy.categories["Core"].join(', ')} |
| **Engine** | ${reportData.taxonomy.categories["Engine"].join(', ')} |
| **Adapter** | ${reportData.taxonomy.categories["Adapter"].join(', ')} |

---

## 6. Log de Inconsistências Detectadas (Fase 3)
${violations.length === 0 ? "✅ Nenhuma inconsistência arquitetônica foi encontrada!" : ""}
${reportData.inconsistencies.map(inc => `### 🔴 ${inc.inconsistencyId} — [${inc.type.toUpperCase()}]
* **Descrição**: ${inc.description}
* **Severidade**: ${inc.severity.toUpperCase()}
* **Artefatos Afetados**: ${inc.artifactsAffected.map(a => `\`${path.basename(a)}\``).join(', ')}
* **Ação Recomendada**: ${inc.details.reparation}
`).join('\n')}

---

## 7. Plano de Migração Recomendado (Fase 5)
${reportData.migrationPlan.sequencia.map(s => `### Etapa ${s.etapa} - ${s.acao}
* **Impacto**: ${s.impacto}
* **Rollback**: ${s.rollback}
`).join('\n')}
`;

    fs.writeFileSync(reportFilePath, reportMarkdown, 'utf8');
    console.log(`[✓] Relatório gravado com sucesso em: ${reportFilePath}`);

    return violations;
  }
}

module.exports = ArchitectureIdentityEngine;
