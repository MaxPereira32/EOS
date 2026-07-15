/**
 * EOS Reporter — Markdown Reporter v0.4.0
 */

const fs = require('fs');
const path = require('path');

class MarkdownReporter {
  generate(execution, outputDir) {
    const mdPath = path.join(outputDir, 'auditoria-automatica.md');
    const ctx = execution.context;
    const gateResults = execution.gateResults || {};

    let md = `# Relatório de Auditoria Automática — EOS v0.6.0\n\n`;
    md += `| Campo | Valor |\n|---|---|\n`;
    md += `| Projeto | ${ctx.project} |\n`;
    md += `| Branch | ${ctx.branch} |\n`;
    md += `| Commit | ${ctx.commit} |\n`;
    md += `| Data | ${ctx.timestamp.split('T')[0]} |\n`;
    md += `| Ambiente | ${ctx.environment} |\n\n`;
    md += `---\n\n`;

    // Métricas
    md += `## 1. Métricas Coletadas\n\n`;
    md += `| Métrica | Valor | Descrição |\n|---|---|---|\n`;
    execution.metrics.forEach(m => {
      md += `| \`${m.name}\` | **${m.value}** | ${m.formula} |\n`;
    });
    md += `\n`;

    // Indicadores
    md += `## 2. Indicadores de Qualidade\n\n`;
    Object.values(execution.indicators).forEach(ind => {
      const penaltyList = ind.penalties.length > 0
        ? ind.penalties.map(p => `${p.ruleId}: -${p.points}`).join(', ')
        : 'nenhuma';
      md += `* **${ind.name}**: **${ind.finalScore}/100** (penalidades: ${penaltyList})\n`;
    });
    md += `\n`;

    // Regras
    if (execution.ruleResults.length > 0) {
      md += `## 3. Regras Ativadas\n\n`;
      execution.ruleResults.forEach(r => {
        const impactStr = r.impacts.map(i => `${i.indicator}: -${i.penalty}`).join(', ');
        md += `* **${r.ruleId}**: ${r.description} ──> [${impactStr}]\n`;
      });
      md += `\n`;
    }

    // Gates
    md += `## 4. Quality Gates\n\n`;
    md += `* **Status**: ${gateResults.passed ? '🟢 APROVADO' : '🔴 REPROVADO'}\n\n`;
    if (gateResults.violations && gateResults.violations.length > 0) {
      md += `### Violações Bloqueantes\n\n`;
      gateResults.violations.forEach(v => {
        md += `* **${v.indicator}** = ${v.score}/100 (mínimo exigido: ${v.min})\n`;
      });
      md += `\n`;
    }

    // Architecture Diff (v0.9)
    if (execution.archDiff && (
      execution.archDiff.nodesAdded.length > 0 ||
      execution.archDiff.nodesRemoved.length > 0 ||
      execution.archDiff.edgesAdded.length > 0 ||
      execution.archDiff.edgesRemoved.length > 0
    )) {
      md += `## 5. Diferencial de Arquitetura (Diff — v0.9)\n\n`;
      md += `Abaixo estão listadas as mutações estruturais na topologia do projeto detectadas em comparação com a linha de base anterior:\n\n`;

      if (execution.archDiff.nodesAdded.length > 0) {
        md += `### ➕ Novos Artefatos Identificados\n`;
        execution.archDiff.nodesAdded.forEach(n => {
          md += `* [Novo ${n.type.toUpperCase()}] \`${n.id}\`\n`;
        });
        md += `\n`;
      }

      if (execution.archDiff.nodesRemoved.length > 0) {
        md += `### ➖ Artefatos Removidos\n`;
        execution.archDiff.nodesRemoved.forEach(n => {
          md += `* [Removido] \`${n.id}\`\n`;
        });
        md += `\n`;
      }

      if (execution.archDiff.edgesAdded.length > 0) {
        md += `### 🔌 Novas Conexões / Dependências de Código\n`;
        execution.archDiff.edgesAdded.forEach(e => {
          md += `* \`${e.from}\` ── [${e.type}] ──> \`${e.to}\`\n`;
        });
        md += `\n`;
      }

      if (execution.archDiff.edgesRemoved.length > 0) {
        md += `### 🔌 Conexões de Dependência Removidas\n`;
        execution.archDiff.edgesRemoved.forEach(e => {
          md += `* \`${e.from}\` ── [${e.type}] ──x \`${e.to}\`\n`;
        });
        md += `\n`;
      }
    }

    fs.writeFileSync(mdPath, md, 'utf8');
    console.log(`[Reporter] Markdown gerado em ${mdPath}`);
  }
}

module.exports = MarkdownReporter;
