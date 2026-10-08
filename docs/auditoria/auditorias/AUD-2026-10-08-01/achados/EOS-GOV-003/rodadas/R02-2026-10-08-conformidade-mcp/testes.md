# EOS-GOV-003 / R02 — Testes

Ambiente e baseline: EVD-A1-EOS-GOV-003-001. Critérios congelados: `../../criterios-aceite.md`.

## Campanha pós-R02

| Teste | Critério | Procedimento | Esperado | Observado | Exit | Evidência |
|---|---|---|---|---|---|---|
| TST-07 | CA-06 | pureza JSONL sobre stdout (alvo scripted) | 0 linhas inválidas | 2 linhas totais, **0 inválidas**; logs em stderr | 0 | EVD-…-010/011/015 |
| TST-01 | CA-01 | smoke MCP, alvo scriptless | relatório real | relatório real; 2 JSON válidos | 0 | EVD-…-016 |
| TST-03 | CA-03 (adversarial) | `project_path` inexistente | erro, nunca SUCCESS | `isError:true` — “O caminho … não existe” | 0 | EVD-…-009/009b |
| TST-04 | CA-04 | smoke MCP, alvo com script `test` | execução real no relatório | `npm run test PASS` presente | 0 | EVD-…-010 |
| TST-08 | CA-07 | `eos audit <alvo-sonda>` | sumário no stdout + exit coerente | sumário `RUN-5e01c40cb4f3` presente; exit 1 (INSUFFICIENT_EVIDENCE do alvo) | 1 | EVD-…-012b |
| TST-06 | CA-05 | `npx tsc --noEmit` | exit 0 | sem erros | 0 | EVD-…-012 / 017c |
| TST-05 | CA-05 | `npm test` | `fail = 0` | **1ª execução: 1 fail** (preservada) → após ajuste de contrato: 172 pass / 0 fail | 1 → 0 | EVD-…-013 → 017 / 017b |

## Falha intermediária preservada (não ocultada)

- **EVD-…-013:** `tests 173, pass 171, fail 1` — teste `emite heartbeat enquanto um quality gate continua em execução` falhou porque espionava `console.log`, canal alterado pela correção (CA-06).
- **Causa raiz:** contrato de canal do teste defasado em relação à correção, não defeito funcional da correção.
- **Ação:** ajuste do spy para `console.error` (EVD-…-017), mantendo os três asserts de conteúdo intactos.
- **Reexecução:** EVD-…-017b — `tests 173, pass 172, fail 0, skip 1`, exit 0. Teste de regressão de canal correto: o validador de pureza (EVD-…-015) falharia no código pré-R02 (2 inválidas) e passa no código R02 (0 inválidas).

## Comparação antes/depois

| Cenário | Antes (EVD-005) | Depois (EVD-010) |
|---|---|---|
| stdout linhas totais / inválidas | 4 / **2** | 2 / **0** |
| stderr | vazio | `[EOS][CHECK] ▶ …`, `… ✓ … PASS` |

## Pendências de teste
- **Auditoria independente (EVD-…-018):** transcrição da verificação por subagente independente (reprodução própria dos testes críticos) — em execução; parecer definitivo da R02 condicionado a ela.
