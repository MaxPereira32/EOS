# AUD-2026-10-08-02 — Matriz de Rastreabilidade

> Vereditos do executor; coluna Auditor completa-se com o parecer independente (subagente).

## EOS-GOV-012

| Critério | Teste | Evidência | Resultado (executor) | Auditor |
|---|---|---|---|---|
| CA-012-01 (ancoragem) | TST-012-01 | EVD-A2-…-003 §1/§4 + suite | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-012-02 (compat. outDir explícito) | TST-012-02 | suite completa | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-012-03 (falha sem sucesso artificial) | TST-012-03 | suite (assert.rejects) | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-012-04 (sem regressão) | TST-012-04 | suite 180/179/0/1 + tsc 0 | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |

## EOS-GOV-013

| Critério | Teste | Evidência | Resultado (executor) | Auditor |
|---|---|---|---|---|
| CA-013-01 (identificação) | TST-013-01 | suite + campanha §2/§3 | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-013-02 (histórico persistido) | TST-013-02 | suite + campanha §1 | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-013-03 (anterior preservada) | TST-013-03 | campanha §2 (hash estável) | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-013-04 (simultâneas) | TST-013-04 | campanha §3 + suite | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-013-05 (índice derivado) | TST-013-05 | suite | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |

## EOS-GOV-014

| Critério | Teste | Evidência | Resultado (executor) | Auditor |
|---|---|---|---|---|
| CA-014-01 (reocorrência vinculada) | TST-014-01 | campanha §2 + suite | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |
| CA-014-02 (sem reuso de evidência) | TST-014-02 | suite (hashes distintos) | Demonstrado | APROVADO — auditor independente (EVD-A2-EOS-GOV-012-005) |

## Notas
- Sinais de interface registrados: `CLI` (bin), `MCP` (servidor), `API` (campanha programática).
- Revisão auditada: working tree s/ `508581c` (inclui AUD-01 não commitada) — alteração posterior invalida a validação.
