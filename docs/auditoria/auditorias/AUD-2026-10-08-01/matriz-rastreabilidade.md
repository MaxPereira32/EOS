# AUD-2026-10-08-01 — Matriz de Rastreabilidade (final)

> Achado → Causa raiz → Alteração → Critério → Teste → Evidência → Parecer → Commit.
> Vereditos de critério validados por **auditor independente** (subagente; transcrição EVD-A1-EOS-GOV-003-018).

## EOS-GOV-003 — mock MCP / conformidade de transporte — **CONCLUÍDO**

| Critério | Teste | Evidência | Resultado | Auditor | Commit |
|---|---|---|---|---|---|
| CA-01 (mock eliminado) | TST-01 | EVD-…-004 / 016 | **APROVADO** | subagente opencode (independente) | working tree s/ `508581c` |
| CA-02 (causa raiz) | TST-02 | EVD-…-002 / 007 / 012 / 017c | **APROVADO** | subagente opencode | working tree |
| CA-03 (adversarial) | TST-03 | EVD-…-009 / 009b | **APROVADO** | subagente opencode | working tree |
| CA-04 (execução real E2E) | TST-04 | EVD-…-005 / 010 | **APROVADO** | subagente opencode | working tree |
| CA-05 (sem regressão) | TST-05/06 | EVD-…-008 / 013→017 / 017b / 017c | **APROVADO** (falha intermediária preservada) | subagente opencode | working tree |
| CA-06 (transporte stdio) | TST-07 | EVD-…-005 (falha R01) → 010/011/015 (R02) | **R01 REPROVADO → R02 APROVADO** | subagente opencode | working tree |
| CA-07 (CLI preservado) | TST-08 | EVD-…-012b | **APROVADO** | subagente opencode | working tree |

## EOS-GOV-011 — histórico de execuções — **CONCLUÍDO**

| Critério | Teste | Evidência | Resultado | Auditor | Commit |
|---|---|---|---|---|---|
| CA-G11-01 (arquiva por execução) | TST-G11-01 | EVD-…-002 | **APROVADO** | subagente opencode (independente) | working tree |
| CA-G11-02 (imutabilidade) | TST-G11-02 | EVD-…-001 (defeito) / 002 (corrigido) | **APROVADO** | subagente opencode | working tree |
| CA-G11-03 (canônico) | TST-G11-01 | EVD-…-002 | **APROVADO** | subagente opencode | working tree |
| CA-G11-04 (sem regressão) | TST-G11-04/05 | EVD-…-004 (174/173/0/1) / 005 | **APROVADO** | subagente opencode | working tree |
| CA-G11-05 (teste detecta defeito) | TST-G11-03 | EVD-…-003a (pré: exit 1) / 003b (pós: exit 0) | **APROVADO** (ressalva: pré-fix corroborado por `git show HEAD`) | subagente opencode | working tree |

## Achados abertos (critérios a definir antes da implementação — §5)

| Achado | Evidência de baseline | Resultado |
|---|---|---|
| EOS-GOV-012 | EVD-…-001 (ancoragem ao cwd) | Pendente |
| EOS-GOV-004 | EVD-…-002 (VERIFIED de mock) | Pendente |
| EOS-SEC-005 | EVD-…-002 (tamper aninhado preserva assinatura) | Pendente |
| EOS-SEC-001 | EVD-…-001 (upload integral do `.eos`) | Pendente |
| EOS-CI-008 | EVD-…-001 (workflow) | Pendente (bloqueado por SEC-005) |
| EOS-GOV-006 | EVD-…-002 (`isValid` com conteúdo falso) | Pendente |
| EOS-SEC-002 | EVD-…-001 (latência fixa) | Pendente |
| EOS-OPS-007 | EVD-…-001 (fatal submodule) | Pendente |
| EOS-DET-009 | EVD-…-001-limite | Em análise (não reproduzido) |

## Notas de integridade

- Integridade material: 32/32 artefatos dos manifestos recalculados pelo auditor independente — **0 divergências**.
- Reutilização explícita: EVD-…-005/010 servem CA-04 e CA-06 (mesma corrida: execução real + transporte).
- `Commit`: working tree não commitado (commit não autorizado) — revisões vinculadas ao estado da árvore + `508581c`; alteração posterior invalida as aprovações.
