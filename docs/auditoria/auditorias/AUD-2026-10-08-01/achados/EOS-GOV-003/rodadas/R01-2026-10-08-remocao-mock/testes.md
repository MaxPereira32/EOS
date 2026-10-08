# EOS-GOV-003 / R01 — Testes

Ambiente e baseline: EVD-A1-EOS-GOV-003-001. Critérios: `../../criterios-aceite.md`.

| Teste | Critério | Comando / procedimento | Esperado | Observado | Exit | Evidência |
|---|---|---|---|---|---|---|
| TST-01 | CA-01 | smoke MCP, alvo scriptless | relatório real, sem mock | relatório real `RUN-cbfb8b2e8164`; mock ausente | 0 | EVD-…-004 |
| TST-04 | CA-04 | smoke MCP, alvo com script `test` | execução real registrada | `npm run test PASS` no relatório | 0 | EVD-…-005 |
| TST-07 | CA-06 | validador de pureza JSONL sobre stdout do TST-04 | stdout 100% JSON-RPC | **2 linhas inválidas** (`[EOS][CHECK]`); stderr vazio | 0 (processo) | EVD-…-005/006/015 |
| TST-05 | CA-05 | `npm test` | `fail = 0` | 173 testes, 172 pass, 0 fail, 1 skip | 0 | EVD-…-008 |
| TST-06 | CA-05 | `npx tsc --noEmit` | exit 0 | sem erros | 0 | EVD-…-007 |
| TST-03 | CA-03 | path inexistente | erro, nunca SUCCESS | **NÃO EXECUTADO na R01** (executado na R02 — EVD-009) | — | — |
| TST-08 | CA-07 | `eos audit <alvo>` | sumário + exit coerente | **NÃO EXECUTADO na R01** (executado na R02 — EVD-012b) | — | — |

## Comparação antes/depois (R01 vs baseline)
- Antes (`508581c` → estado pré-R01, documentado pelo diff EVD-002): resposta estática de sucesso para qualquer entrada (impossibilidade estrutural de detectar falhas — evidência: o próprio diff, que mostra resposta incondicional).
- Depois (R01): execução real e relatório autêntico — **porém** regressão de canal (CA-06).

## Conclusão de testes
Os testes executados demonstram a mudança de comportamento exigida por CA-01/CA-04/CA-05; o teste de contrato de transporte (TST-07) **detectou a falha** que motivou a reabertura. Testes não executados nesta rodada estão explicitamente marcados (proibição de aprovação sem execução).
