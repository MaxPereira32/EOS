# EOS PROMPT CONTRACT: STAGE 04 - RISK & MACHINE-ACTIONABLE REMEDIATION
# DOMAIN TARGETS: Risk, Remediation Entities

## INSTRUÇÕES DE EXECUÇÃO:
Calcule a Matriz de Risco Composta contextualizada ao impacto financeiro, legal, operacional e reputacional do ativo. Para cada `Finding`, gere um Objeto de Remediação (`Remediation`) contendo o patch de código em Unified Diff.

### FÓRMULA DO MOTOR DE RISCO:
`Risk Score = (Probabilidade 1-10) × [Média(Impacto Financeiro, Legal, Operacional, Reputacional)] × Weight(CIA Triad)`

### FORMATO DE SAÍDA (STRICT JSON SCHEMA):
```json
{
  "$schema": "https://eos.architecture/schemas/v2/stage04-remediation.json",
  "remediations": [
    {
      "fix_id": "FIX-8801",
      "finding_id": "FND-2026-8801",
      "priority": "HIGH",
      "estimated_effort_hours": 1.5,
      "target_files": ["k8s/ingress.yaml", "src/server.ts"],
      "commit_hint": "fix(security): disable TRACE method and enforce __Host- cookie prefix",
      "breaking_change": false,
      "patch_diff": "--- a/k8s/ingress.yaml\n+++ b/k8s/ingress.yaml\n@@ -18,2 +18,3 @@\n+   nginx.ingress.kubernetes.io/server-snippet: |\n+     if ($request_method = TRACE) { return 405; }\n--- a/src/server.ts\n+++ b/src/server.ts\n@@ -10,1 +10,1 @@\n- res.cookie('session_id', token, { path: '/' });\n+ res.cookie('__Host-session_id', token, { path: '/', secure: true, httpOnly: true, sameSite: 'strict' });"
    }
  ]
}
```
