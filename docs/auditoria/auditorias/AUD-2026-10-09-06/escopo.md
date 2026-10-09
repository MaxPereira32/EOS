# AUD-2026-10-09-06 — Escopo (sequência A6)

| Campo | Valor |
|---|---|
| **Data** | 2026-10-09 |
| **Branch** | `fix/cor09-verify-audit` (base `581c7a5`) |
| **Escopo** | COR-09 (`verify-audit`: integridade de manifestos + trava parecer↔SHA) + remoção dos artefatos de deploy Firebase (sem pretensão de hosting — decisão do usuário; motores/adapters Firestore preservados para outros alvos) |
| **Executor** | opencode (R01) |
| **Critérios** | CA-09-01..04 (plano-fase2) |
| **Auditor** | independente, pendente |

## Nota sobre o aceite CA-01-03

Com a remoção de `firestore.rules`/`firebase.json`, o risco residual ali aceito **deixa de existir** (artefato removido, não apenas não-auditado). Aceite superado, não revogado.
