# AUD-2026-10-08-01 — Escopo e Identificação

| Campo | Valor |
|---|---|
| **Audit ID** | AUD-2026-10-08-01 |
| **Sequência de evidência** | A1 |
| **Data** | 2026-10-08 (TZ America/Sao_Paulo, UTC−3) |
| **Objetivo** | Reauditoria independente do plano de correções do EOS sob a Diretriz de Governança (`../../diretriz-governanca.md`): validar a correção EOS-GOV-003 (rodadas R01/R02), registrar e corrigir a sobrescrita de artefatos (EOS-GOV-011) e reestabelecer o baseline dos demais achados com evidência real. |
| **Projeto** | Engineering Operating System (EOS) v2.2.0 — `C:\Users\lindo\OneDrive\Desktop\Dev\Projeto\EOS` |
| **Baseline** | commit `508581c` (branch `main`); working tree modificado: `EOS/core/platform/eos-mcp-server.ts`, `EOS/core/services/audit-application-service.ts`, `EOS/tests/execution-observability.test.ts`; não rastreado: `docs/auditoria/` — vide EVD-A1-EOS-GOV-003-001 |
| **Ambiente** | Windows (build conforme EVD-001); Node/npm/tsx e PowerShell registrados em EVD-001 |
| **Executor** | opencode (deepseek-v4.1-flash) — R01 foi executada por agente anterior (Antigravity/Codex) |
| **Auditores** | R01: opencode (independente do implementador original); R02 e EOS-GOV-011: subagente opencode independente (transcrição em evidência) |
| **Achados no escopo** | EOS-GOV-003 (validação integral), EOS-GOV-011 (novo, diagnóstico→correção→validação), EOS-GOV-004/005/SEC-001/CI-008/006/SEC-002/OPS-007/DET-009 (re-verificação de baseline) |
| **Fora do escopo** | Implementação das correções dos achados pendentes (permanecem `Pendente`/`Em análise`); commit das alterações (não autorizado) |
| **Limitações** | (a) R01 foi implementada sem contrato de aceite prévio — critérios formalizados post-hoc (D-004); (b) EOS-DET-009 não reproduzido nesta baseline (evidência de limitação registrada); (c) auditoria independente por subagente ocorre no mesmo host (independência de verificação, não de infraestrutura) |

## Documentos desta auditoria

- `plano-de-correcoes.md` — status corrente.
- `matriz-rastreabilidade.md` — achado→critério→teste→evidência→parecer→commit.
- `historico-decisoes.md` — decisões datadas (append-only).
- `achados/<ID>/` — dossiês por achado (diagnóstico, critérios, rodadas, evidências, pareceres).
