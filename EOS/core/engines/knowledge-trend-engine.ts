/**
 * EOS ADAPTIVE KNOWLEDGE & TREND ENGINE (v2.1.0)
 * 
 * Historical audit delta calculation, detector reliability weight adjustments,
 * and artifact exporter (.eos/auditoria.json & .eos/acf-auditoria.md).
 */

export interface AuditSummary {
  audit_run_id: string;
  timestamp: string;
  total_assets_inspected: number;
  total_findings: number;
  composite_risk_score: number;
  trend_delta: {
    previous_audit_id: string;
    risk_delta_score: number;
    resolved_findings_count: number;
  };
}

export interface KnowledgeEngineFeedback {
  rule_id: string;
  feedback_type: 'CONFIRM_ACCURACY' | 'FALSE_POSITIVE' | 'RECURRENCE';
  reliability_weight_adjustment: number;
}

export interface AuditArtifactReport {
  $schema: string;
  audit_summary: AuditSummary;
  knowledge_engine_feedback: KnowledgeEngineFeedback[];
}

export class KnowledgeTrendEngine {
  /**
   * Calcula o delta de risco histórico comparando a execução atual com o histórico
   */
  public computeAuditTrend(
    currentRunId: string,
    totalAssets: number,
    totalFindings: number,
    compositeRiskScore: number,
    previousAuditSummary?: Partial<AuditSummary>
  ): AuditSummary {
    const prevRisk = previousAuditSummary?.composite_risk_score || 0;
    const prevAuditId = previousAuditSummary?.audit_run_id || 'AUDIT-HISTORICAL-BASELINE';
    
    const riskDeltaScore = Math.round((compositeRiskScore - prevRisk) * 10) / 10;
    const resolvedCount = Math.max(0, (previousAuditSummary?.total_findings || 0) - totalFindings);

    return {
      audit_run_id: currentRunId,
      timestamp: new Date().toISOString(),
      total_assets_inspected: totalAssets,
      total_findings: totalFindings,
      composite_risk_score: compositeRiskScore,
      trend_delta: {
        previous_audit_id: prevAuditId,
        risk_delta_score: riskDeltaScore,
        resolved_findings_count: resolvedCount,
      },
    };
  }

  /**
   * Gera realimentação para a Base de Conhecimento do EOS
   */
  public generateKnowledgeFeedback(
    ruleIds: string[],
    accuracyConfirmed: boolean = true
  ): KnowledgeEngineFeedback[] {
    return ruleIds.map((ruleId) => ({
      rule_id: ruleId,
      feedback_type: accuracyConfirmed ? 'CONFIRM_ACCURACY' : 'FALSE_POSITIVE',
      reliability_weight_adjustment: accuracyConfirmed ? 0.05 : -0.15,
    }));
  }

  /**
   * Constrói o relatório formatado em Markdown para o artefato .eos/acf-auditoria.md
   */
  public generateMarkdownReport(report: AuditArtifactReport): string {
    const s = report.audit_summary;
    const deltaSign = s.trend_delta.risk_delta_score <= 0 ? '' : '+';

    return [
      `# RELATÓRIO DE AUDITORIA DE ARQUITETURA EOS (v2.1 Enterprise)`,
      `**Audit Run ID:** \`${s.audit_run_id}\``,
      `**Data/Hora:** ${s.timestamp}`,
      ``,
      `---`,
      ``,
      `## 1. RESUMO EXECUTIVO DE RISCO`,
      `- **Ativos Inspecionados:** ${s.total_assets_inspected}`,
      `- **Achados Encontrados:** ${s.total_findings}`,
      `- **Score de Risco Composto:** \`${s.composite_risk_score} / 100.0\``,
      `- **Variação Histórica (Delta):** \`${deltaSign}${s.trend_delta.risk_delta_score}\` (vs. \`${s.trend_delta.previous_audit_id}\`)`,
      `- **Achados Resolvidos:** ${s.trend_delta.resolved_findings_count}`,
      ``,
      `---`,
      ``,
      `## 2. MALHA DE ADAPTAÇÃO DA BASE DE CONHECIMENTO`,
      `| Regra ID | Tipo de Feedback | Ajuste de Peso Confiabilidade |`,
      `|---|---|---|`,
      ...report.knowledge_engine_feedback.map(
        (f) => `| \`${f.rule_id}\` | \`${f.feedback_type}\` | \`${f.reliability_weight_adjustment > 0 ? '+' : ''}${f.reliability_weight_adjustment}\` |`
      ),
      ``,
      `---`,
      `*Gerado autonomamente pelo EOS v2.1 Enterprise Governance Engine.*`,
    ].join('\n');
  }
}
