/**
 * EOS ACF Engine — Reporting Engine
 * 
 * Executa o Modelo 8: Relatório.
 * Consolida todas as análises, métricas, indicadores, diagnósticos, planos ricos de refatoração,
 * visualização de Árvore de Impacto, Matriz de Dependência e tendências de regressão.
 */

const fs = require('fs');
const path = require('path');

class ReportingEngine {
  /**
   * Gera o relatório Markdown do ACF e retorna a representação em texto.
   * 
   * @param {object} reportsData - Dados consolidados
   * @param {import('../../domain/fact')[]} reportsData.facts - Fatos gerados no ciclo
   * @param {import('../../domain/metric')[]} reportsData.metrics - Métricas do ACF
   * @param {object} reportsData.regression - Dados de regressão
   * @param {string} outputDir - Diretório onde o relatório será salvo
   * @returns {string} Relatório Markdown formatado
   */
  execute(reportsData, outputDir) {
    console.log('[ACF Engine] Iniciando Modelo 12: Relatório de Consistência de Artefatos v1.0.0...');
    const { facts, metrics, regression } = reportsData;

    // Separar os fatos para exibição
    const artifacts = [];
    const inconsistencies = [];
    const dependencies = [];
    const plans = [];
    const executions = [];
    let validation = null;
    let profile = null;
    const complexityAnalyses = [];

    facts.forEach(f => {
      if (f.metric === 'acf.artifact.identified') {
        artifacts.push(f.metadata);
      } else if (f.metric === 'acf.inconsistency.detected') {
        inconsistencies.push(f.metadata);
      } else if (f.metric === 'acf.dependency.established') {
        dependencies.push(f.metadata);
      } else if (f.metric === 'acf.change.planned') {
        plans.push(f.metadata);
      } else if (f.metric === 'acf.change.applied') {
        executions.push(f.metadata);
      } else if (f.metric === 'acf.validation.executed') {
        validation = f.metadata;
      } else if (f.metric === 'acf.profile.discovered') {
        profile = f.metadata;
      } else if (f.metric === 'acf.complexity.analyzed') {
        complexityAnalyses.push(f.metadata);
      }
    });

    const scoreMetric = metrics.find(m => m.name === 'acf.consistencyScore');
    const score = scoreMetric ? scoreMetric.value : 100;

    let md = `# Relatório Avançado de Consistência de Artefatos (ACF) — EOS v1.0.0\n\n`;

    if (profile) {
      md += `## 🏛️ Perfil Arquitetural Descoberto (Fase 0)\n\n`;
      md += `* **Linguagens**: ${profile.languages.join(', ') || 'Nenhuma detectada'}\n`;
      md += `* **Frameworks**: ${profile.frameworks.join(', ') || 'Nenhum detectado'}\n`;
      md += `* **Mecanismos de Estilização**: ${profile.styling.join(', ') || 'Nenhum detectado'}\n`;
      md += `* **Estrutura de Diretórios**: \`${profile.structure.dirs.join(', ')}\` (Possui \`src/\`: ${profile.structure.hasSrc ? 'Sim' : 'Não'})\n\n`;
      md += `---\n\n`;
    }
    
    // Status Cards / Indicadores
    md += `## 📊 Painel Executivo e Score Arquitetural\n\n`;
    md += `> [!IMPORTANT]\n`;
    md += `> **ACF Consistency Score: ${score}/100**\n`;
    md += `> \n`;
    md += `> Status Geral: ${score >= 90 ? '🟢 Excelente' : score >= 70 ? '🟡 Atenção' : '🔴 Crítico'}\n`;
    md += `> Tendência de Regressão: ${regression.trend === 'improving' ? '↗️ Melhorando' : regression.trend === 'regressing' ? '↘️ Regredindo' : '➡️ Estável'}\n\n`;

    // Radar de Consistência / Heatmap de Risco
    md += `### 🌡️ Heatmap de Riscos Ativos\n\n`;
    const criticalInc = inconsistencies.filter(i => i.severity === 'critical').length;
    const highInc = inconsistencies.filter(i => i.severity === 'high').length;
    const mediumInc = inconsistencies.filter(i => i.severity === 'medium').length;
    const lowInc = inconsistencies.filter(i => i.severity === 'low').length;

    md += `| Gravidade | Ocorrências | Nível de Risco | Status |\n`;
    md += `|---|---|---|---|\n`;
    md += `| 🟥 CRÍTICO | **${criticalInc}** | Bloqueante | ${criticalInc > 0 ? '❌ Falhando' : '✅ OK'} |\n`;
    md += `| 🟧 ALTO | **${highInc}** | Alto Risco | ${highInc > 0 ? '⚠️ Atenção' : '✅ OK'} |\n`;
    md += `| 🟨 MÉDIO | **${mediumInc}** | Moderado | ${mediumInc > 2 ? '⚠️ Alerta' : '✅ OK'} |\n`;
    md += `| 🟦 BAIXO | **${lowInc}** | Baixo | ✅ OK |\n\n`;

    // Resumo Métricas
    md += `### 📈 Métricas Estruturadas (Grafo Semântico)\n\n`;
    md += `| Métrica | Valor | Descrição |\n`;
    md += `|---|---|---|\n`;
    metrics.forEach(m => {
      md += `| \`${m.name}\` | **${m.value}** | ${m.formula} |\n`;
    });
    md += `\n`;

    // Diagnóstico de Inconsistências
    md += `## 🔍 Diagnóstico de Inconsistências Detectadas\n\n`;
    if (inconsistencies.length === 0) {
      md += `🟢 **Nenhuma inconsistência de consistência ou integridade foi detectada!**\n\n`;
    } else {
      md += `| ID | Tipo | Severidade | Grau de Confiança | Descrição | Afetados |\n`;
      md += `|---|---|---|---|---|---|\n`;
      inconsistencies.forEach(inc => {
        const severityEmoji = inc.severity === 'critical' ? '🔴' : inc.severity === 'high' ? 'orange_square' : inc.severity === 'medium' ? '🟡' : '🔵';
        const confidencePct = `${Math.round(inc.confidenceScore * 100)}%`;
        md += `| \`${inc.inconsistencyId}\` | **${inc.type}** | ${inc.severity.toUpperCase()} | **${confidencePct}** | ${inc.description} | \`${inc.artifactsAffected.join(', ')}\` |\n`;
      });
      md += `\n`;
    }

    // Análise de Complexidade Estrutural (Fase 6)
    if (complexityAnalyses.length > 0) {
      md += `## 🧬 Análise de Complexidade Estrutural (Fase 6)\n\n`;
      md += `| Artefato | Complexidade | Acoplamento | Coesão | Reutilização | Fatores Observados |\n`;
      md += `|---|---|---|---|---|---|\n`;
      complexityAnalyses.forEach(c => {
        md += `| \`${c.artifactId}\` | **${c.complexityIndex}/100** | ${c.couplingIndex}/100 | ${c.cohesionIndex}/100 | Consumido ${c.reusedTimes}x | ${c.factors.join(', ') || 'Estrutura saudável'} |\n`;
      });
      md += `\n`;
    }

    // Grafo de Correlação (Exibição textual)
    md += `## 🕸️ Grafo Semântico de Dependências (Mermaid)\n\n`;
    md += `\`\`\`mermaid\ngraph TD\n`;
    if (dependencies.length === 0) {
      md += `  NoDependencies["Sem dependências detectadas no grafo semântico"]\n`;
    } else {
      dependencies.forEach(dep => {
        const from = dep.from.replace(/[^a-zA-Z0-9]/g, '_');
        const to = dep.to.replace(/[^a-zA-Z0-9]/g, '_');
        md += `  ${from} -->|${dep.type}| ${to}\n`;
      });
    }
    md += `\`\`\`\n\n`;

    // Matriz de Dependência (DSM simplificada)
    md += `### 🧮 Matriz de Dependências\n\n`;
    if (dependencies.length === 0) {
      md += `*Sem dependências de acoplamento registradas.*\n\n`;
    } else {
      md += `| Artefato de Origem | Relação | Alvo de Dependência |\n`;
      md += `|---|---|---|\n`;
      dependencies.forEach(dep => {
        md += `| \`${dep.from}\` | ── [${dep.type}] ──> | \`${dep.to}\` |\n`;
      });
      md += `\n`;
    }

    // Árvore de Impacto & RefactoringPlan
    if (plans.length > 0) {
      md += `## 📋 Árvore de Impacto e Planos de Refatoração\n\n`;
      plans.forEach(p => {
        const confPct = `${Math.round(p.confidenceScore * 100)}%`;
        md += `### 🛠️ Plano: \`${p.changeId}\` ──> Alvo: \`${p.target}\`\n`;
        md += `* **Ação Geral**: ${p.description}\n`;
        md += `* **Impacto Estimado**: \`${p.estimatedImpact.toUpperCase()}\` | **Confiança da Ação**: \`${confPct}\`\n`;
        md += `* **Risco**: \`[${p.risks.level.toUpperCase()}]\` — ${p.risks.description}\n`;
        md += `* **Passos Concretos de Refatoração (Actions)**:\n`;
        p.actions.forEach(act => {
          md += `  - [ ] ${act}\n`;
        });
        md += `* **Instruções de Rollback**: \`${p.rollback}\`\n`;
        md += `* **Inconsistências Corrigidas**: \`${p.inconsistenciesResolved.join(', ')}\`\n\n`;
        md += `---\n\n`;
      });
    }

    // Execução e Validação
    if (executions.length > 0) {
      md += `## 🛠️ Resultado da Execução de Refatorações\n\n`;
      md += `| ID Plano | Status da Alteração | Detalhes |\n`;
      md += `|---|---|---|\n`;
      executions.forEach(e => {
        const statusEmoji = e.status === 'success' ? '🟢 SUCESSO' : e.status === 'skipped' ? '🟡 SIMULADO' : '🔴 FALHA';
        md += `| \`${e.changeId}\` | ${statusEmoji} | ${JSON.stringify(e.details)} |\n`;
      });
      md += `\n`;

      if (validation) {
        md += `### 🔄 Validação Pós-Refatoração\n\n`;
        md += `* **Resultado da Validação**: ${validation.status === 'passed' ? '🟢 APROVADO' : '🔴 REPROVADO'}\n`;
        md += `* **Verificações executadas**: ${validation.checksRun}\n`;
        if (validation.failures && validation.failures.length > 0) {
          md += `#### Inconsistências Restantes:\n`;
          validation.failures.forEach(f => {
            md += `  * \`${f.inconsistencyId}\` (${f.type}): ${f.description}\n`;
          });
        }
        md += `\n`;
      }
    }

    // Tendência Histórica (Regressão)
    md += `## 📉 Tendência e Regressão Arquitetural\n\n`;
    md += `* **Estado Anterior (Total)**: ${regression.historicalTotal} inconsistências\n`;
    md += `* **Estado Atual (Total)**: ${regression.currentTotal} inconsistências\n`;
    md += `* **Delta Líquido**: ${regression.delta > 0 ? `+${regression.delta}` : regression.delta}\n`;
    if (regression.regressionDetected) {
      md += `⚠️ **Aviso de Regressão**: Foram detectadas novas inconsistências nesta execução. Verifique a lista acima.\n`;
    } else {
      md += `✅ **Nenhuma regressão detectada**. A base de código está estável ou em melhoria contínua de consistência.\n`;
    }
    md += `\n`;

    // Gravar o arquivo markdown
    if (outputDir) {
      const reportPath = path.join(outputDir, 'acf-auditoria.md');
      fs.writeFileSync(reportPath, md, 'utf8');
      console.log(`[ACF Reporter] Relatório Markdown gerado em ${reportPath}`);
    }

    return md;
  }
}

module.exports = ReportingEngine;
