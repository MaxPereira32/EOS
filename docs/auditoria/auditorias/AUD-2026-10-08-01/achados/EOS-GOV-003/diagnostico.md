# EOS-GOV-003 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-GOV-003 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Interface MCP declara auditorias aprovadas sem executá-las |
| **Origem** | Auditoria de origem registrada em `../../../plano_de_correcoes_auditoria_codex.md` (registro histórico preservado) |
| **Criticidade** | Crítica — um agente MCP recebia “auditoria aprovada” (`quality_gates.passed: true`, score 94.5) sem execução real. Exploração trivial; exposição: toda integração MCP. |
| **Prioridade** | P0 |
| **Status atual** | Em validação — R01 **REPROVADO** (CA-06, EVD-005/006); R02 implementada e testada, aguardando parecer da auditoria independente (EVD-018) |
| **Executor** | R01: Antigravity/Codex · R02: opencode |
| **Auditor** | R01: opencode (independente do implementador original) · R02: subagente opencode |
| **Baseline** | commit `508581c` (EVD-A1-EOS-GOV-003-001) |
| **Arquivos afetados** | `EOS/core/platform/eos-mcp-server.ts` (R01); `EOS/core/services/audit-application-service.ts` (R02, causa secundária); `EOS/tests/execution-observability.test.ts` (R02, contrato de teste) |

## Causa raiz

O handler `handleToolCall` retornava objeto estático de sucesso — independente de `project_path` e de qualquer entrada — sem instanciar o provedor real (`AuditApplicationService`). Causa secundária revelada na R02: o serviço de auditoria emitia diagnósticos de execução via `console.log`, que ocupa o canal stdout do transporte MCP (reservado ao JSON-RPC).

## Impacto

- Falso verde sistêmico em integrações MCP (agentes recebiam aprovação sem execução).
- Após R01: com execução real, violação do transporte stdio (stdout ≠ apenas protocolo) — clientes MCP estritos podem falhar ao parsear a resposta.

## Evidência original e de reprodução

- EVD-A1-EOS-GOV-003-001 — baseline (git/versões/ambiente).
- EVD-A1-EOS-GOV-003-002 — diff R01 (remoção do mock).
- EVD-A1-EOS-GOV-003-003 — entrada JSON-RPC de reprodução (procedure).
- EVD-A1-EOS-GOV-003-004 — smoke-01 (scriptless, pré-R02): relatório real (mock morto).
- EVD-A1-EOS-GOV-003-005/006 — smoke-02 (scripted, pré-R02): stdout poluído / stderr vazio (CA-06 REPROVADO).
- EVD-A1-EOS-GOV-003-009…017c — campanha pós-R02 (ver `rodadas/R02-2026-10-08-conformidade-mcp/testes.md`).
- EVD-A1-EOS-GOV-003-015 — validador de pureza JSONL: pré-R02 = 2 linhas inválidas; pós-R02 = 0.

## Procedimento de reprodução

1. Projeto-sonda com `package.json` (variante scriptless: `scripts:{}`; variante scripted: `"test": "node -e \"process.exit(0)\""` — manifestos em EVD-003a/003b).
2. Enviar por stdin a `npx tsx EOS/bin/eos.ts mcp` as linhas de EVD-003 (initialize + `tools/call eos_run_audit`).
3. Validar: stdout composto somente de linhas JSON parseáveis; linhas `[EOS][CHECK]` apenas em stderr (validador EVD-015).

## Resultado real

- **R01:** mock eliminado (EVD-004), execução real presente (EVD-005) — porém stdout poluído (2 linhas não-JSON) e stderr vazio ⇒ CA-06 REPROVADO.
- **R02:** stdout com 2 linhas JSON válidas (0 inválidas), logs em stderr; adversarial com path inexistente ⇒ `isError: true` (EVD-009); suíte 172/0 (EVD-017b).

## Limitações da verificação

- R01 não teve contrato de aceite registrado antes da implementação (critérios formalizados post-hoc — D-004).
- O parecer definitivo da R02 depende da auditoria independente (EVD-018), ainda não registrada no fechamento deste documento.
- Working tree modificado durante toda a auditoria (as duas rodadas são estados não-commitados sobre `508581c`).
