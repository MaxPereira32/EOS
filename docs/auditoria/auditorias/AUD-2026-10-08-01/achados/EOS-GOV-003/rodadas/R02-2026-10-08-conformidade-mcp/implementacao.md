# EOS-GOV-003 / R02 — Implementação (executor: opencode)

## Problema a corrigir (critério reprovado)
**CA-06** — stdout do servidor MCP continha linhas não-JSON (`[EOS][CHECK] ▶/…/✓`) durante `tools/call`; stderr vazio (EVD-005/006).

## Solução proposta
Roteamento dos diagnósticos do caminho de auditoria para **stderr**: `console.log` → `console.error` em `EOS/core/services/audit-application-service.ts`, linhas 482 (início), 514 (heartbeat) e 606 (resultado). O stdout permanece exclusivo do JSON-RPC. Diagnósticos em stderr é o canal convencional de CLI; nenhuma informação é perdida.

## Alternativas avaliadas e descartadas
1. **Redirecionamento global de `console.log` no `EosMcpServer`** — descartada: patch global implícito; esconderia também logs de componentes de terceiros; não corrige a origem.
2. **Silenciar logs no modo MCP** — descartada: perda de observabilidade de execução (heartbeat/timeout), funcionalidade coberta por teste.

## Dependências
Nenhuma nova. Requer apenas a revisão R01 presente no working tree.

## Riscos de implementação
- Baixo: alteração de canal de log; nenhuma lógica de gate/evidência alterada.
- Risco de contrato em teste que observava o canal antigo — materializado e tratado (ver testes.md: EVD-013 → EVD-017 → EVD-017b).

## Arquivos efetivamente alterados
| Arquivo | Alteração | Diff |
|---|---|---|
| `EOS/core/services/audit-application-service.ts` | 3× `console.log` → `console.error` | EVD-…-014 |
| `EOS/tests/execution-observability.test.ts` | spy `console.log` → `console.error` (contrato do canal) | EVD-…-017 |

## Plano de reversão
`git checkout -- EOS/core/services/audit-application-service.ts EOS/tests/execution-observability.test.ts` retorna ao estado R01 sobre `508581c`. **Atenção:** como R01+R02 não estão commitadas, reverter a R02 não restaura o baseline original — perda da R01 junto (risco registrado).

## Mudanças fora do escopo previsto
Apenas o ajuste do teste de observabilidade — inerente à mudança de contrato do canal; declarado e justificado (D-008).

## Revisão exata submetida à auditoria
Working tree em 2026-10-08, base `508581c`: `EOS/core/platform/eos-mcp-server.ts` (R01), `EOS/core/services/audit-application-service.ts` (R02), `EOS/tests/execution-observability.test.ts` (R02).
