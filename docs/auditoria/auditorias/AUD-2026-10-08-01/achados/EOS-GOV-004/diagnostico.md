# EOS-GOV-004 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-GOV-004 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Orquestração multiagente emite VERIFIED a partir de mock fixo (EVI-123) |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Crítica — o comando operacional pode atestar restauração de propriedade sem execução real de agentes |
| **Prioridade** | P0 |
| **Status** | Pendente (critérios a definir antes da implementação — §5) |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `EOS/bin/eos.ts:105-120` (MockAgentExecutor com `status:'SUCCESS'` e `evidence_ids:['EVI-123']`), `EOS/core/engines/multi-agent-orchestration-engine.ts:147-160` (gate bloqueia apenas evidência vazia) |

## Causa raiz

O caso `orchestrate` injeta mocks determinísticos com evidência fixa não-vazia. O reconciliador bloqueia veredito falso apenas quando `evidence_ids` é vazio; uma evidência **fixa** satisfaz o gate — e é exatamente o que o mock fornece.

## Impacto

- VERIFIED operacional derivado de dados sintéticos — falso verde no fluxo multiagente (análogo ao EOS-GOV-003, outro canal).

## Evidência (reprodução real)

- EVD-A1-EOS-GOV-004-001 — inspeção estática (mock + reconciler).
- EVD-A1-EOS-GOV-004-002 — execução real: `eos orchestrate FIND-REPRO-001` → `Final State: VERIFIED`, `VERDICT: [ VERIFIED ]`, exit 0 (trace em `EOS-EXPERIMENT-0002-EXECUTION-TRACE.json` do cwd de execução).

## Limitações
- Reprodução executada em cwd temporário (o comando escreve trace no cwd). Teste dos cenários adversariais de correção (evidência forjada com ID arbitrário não-vazio) fica para a implementação.
