# EOS PROMPT CONTRACT: STAGE 05 - TREND & KNOWLEDGE ENGINE
# DOMAIN TARGETS: AuditTrend, KnowledgeNode Entities

## INSTRUÇÕES DE EXECUÇÃO:
Verifique a re-execução do patch, calcule o delta histórico de risco do projeto e atualize a Base de Conhecimento do EOS (`Knowledge Base`) para ajustar pesos de falso positivo e recorrências de violação.

### FORMATO DE SAÍDA PARA ARTEFATOS (`.eos/acf-auditoria.md` E `.eos/auditoria.json`):
```json
{
  "$schema": "https://eos.architecture/schemas/v2/stage05-trend-knowledge.json",
  "audit_summary": {
    "audit_run_id": "AUDIT-2026-07-30-V2",
    "total_assets_inspected": 12,
    "total_findings": 1,
    "composite_risk_score": 11.2,
    "trend_delta": {
      "previous_audit_id": "AUDIT-2026-07-15-V1",
      "risk_delta_score": -34.8,
      "resolved_findings_count": 3
    }
  },
  "knowledge_engine_feedback": [
    {
      "rule_id": "SEC-RULE-309",
      "feedback_type": "CONFIRM_ACCURACY",
      "reliability_weight_adjustment": 0.05
    }
  ]
}
```
