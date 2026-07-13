/**
 * EOS Reporter — v0.3.0
 * 
 * Gera relatórios a partir dos resultados do pipeline.
 * Responsável por persistir os dados em formatos consumíveis:
 *   - JSON (fonte de verdade estruturada)
 *   - Markdown (visualização humana)
 * 
 * Futuramente pode gerar HTML, SARIF ou enviar para dashboards.
 */

const fs = require('fs');
const path = require('path');

class Reporter {
  /**
   * Gera e persiste o relatório em JSON e Markdown.
   * @param {object} context - Dados completos da sessão.
   * @param {string} outputDir - Diretório de saída (.eos/auditorias/).
   */
  generate(context, outputDir) {
    this._generateJSON(context, outputDir);
    this._generateMarkdown(context, outputDir);
  }

  _generateJSON(context, outputDir) {
    const jsonPath = path.join(outputDir, 'auditoria.json');
    const output = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      projeto: context.projeto || 'Desconhecido',
      data: new Date().toISOString().split('T')[0],
      versao_eos: '0.3.0',
      perfil_arquitetural: context.perfil_arquitetural || 'DESCONHECIDO',
      indicadores: context.indicators || {},
      metricas: context.metrics || {},
      fatos: context.rawFacts || {},
      fatos_canonicos: context.canonicalFacts || {},
      regras_aplicadas: context.appliedRules || [],
      quality_gates: context.gateResults || {},
      eventos: context.eventLog || []
    };

    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[Reporter] JSON gerado em ${jsonPath}`);
  }

  _generateMarkdown(context, outputDir) {
    const mdPath = path.join(outputDir, 'auditoria-automatica.md');
    const indicators = context.indicators || {};
    const metrics = context.metrics || {};
    const gateResults = context.gateResults || {};
    const rules = context.appliedRules || [];

    let md = `# Relatório de Auditoria Automática — EOS v0.3.0\n\n`;
    md += `**Projeto**: ${context.projeto || 'Desconhecido'}\n`;
    md += `**Data**: ${new Date().toISOString().split('T')[0]}\n`;
    md += `**Perfil Arquitetural**: ${context.perfil_arquitetural || 'DESCONHECIDO'}\n\n`;
    md += `---\n\n`;

    // Métricas
    md += `## 1. Métricas Coletadas\n\n`;
    md += `| Métrica | Valor |\n|---|---|\n`;
    Object.keys(metrics).forEach(key => {
      md += `| ${key} | ${metrics[key]} |\n`;
    });
    md += `\n`;

    // Indicadores
    md += `## 2. Indicadores de Qualidade\n\n`;
    Object.keys(indicators).forEach(key => {
      md += `* **${key}**: **${indicators[key]}/100**\n`;
    });
    md += `\n`;

    // Regras Aplicadas
    if (rules.length > 0) {
      md += `## 3. Regras Ativadas\n\n`;
      rules.forEach(r => {
        md += `* **${r.id}**: ${r.description} ──> -${r.penalty} em ${r.indicator}\n`;
      });
      md += `\n`;
    }

    // Quality Gates
    md += `## 4. Quality Gates\n\n`;
    md += `* **Status**: ${gateResults.passed ? '🟢 APROVADO' : '🔴 REPROVADO'}\n\n`;

    if (gateResults.violations && gateResults.violations.length > 0) {
      md += `### Violações Bloqueantes\n\n`;
      gateResults.violations.forEach(v => {
        md += `* **${v.indicator}** = ${v.score}/100 (mínimo exigido: ${v.min})\n`;
      });
    }

    fs.writeFileSync(mdPath, md, 'utf8');
    console.log(`[Reporter] Markdown gerado em ${mdPath}`);
  }
}

module.exports = Reporter;
