# EOS-GOV-003 — Contrato de Aceite

> **Congelamento:** critérios **não são alterados após a implementação** (Diretriz §2 e §5). CA-01…CA-05 foram formalizados post-hoc para a R01 (limitação D-004); CA-06/CA-07 foram definidos **antes** da implementação da R02 (D-004). Qualquer mudança futura entra como `CA-change-log` com aprovação do auditor.

## Critérios

### CA-01 — O mock estático deixa de existir no caminho `eos_run_audit`
- **Entrada:** alvo sem scripts; chamada JSON-RPC `tools/call eos_run_audit` (TST-01).
- **Esperado:** relatório real (`audit_run_id`, `coverage`, `rule_results`); ausência de `{status:"SUCCESS", quality_gates:{passed:true, score:94.5}}`.
- **Evidência:** EVD-A1-EOS-GOV-003-004 (R01) e …-016 (R02).
- **Reprovação:** qualquer resposta estática/equivalente ao mock.

### CA-02 — Causa raiz eliminada no código
- **Entrada:** inspeção de `eos-mcp-server.ts` na revisão auditada + typecheck (TST-02).
- **Esperado:** `await service.executeAudit(targetPath)`; nenhum objeto de sucesso hardcoded.
- **Evidência:** EVD-…-002 (diff R01), EVD-…-007/012/017c (typecheck exit 0).
- **Reprovação:** resposta estática no caso `eos_run_audit`.

### CA-03 — Falha de execução propaga erro (adversarial)
- **Entrada:** `project_path` inexistente (TST-03).
- **Esperado:** resposta de erro (`isError:true`) ou erro descritivo; nunca `SUCCESS`. (Na versão defeituosa o mock respondia SUCCESS incondicionalmente — EVD-002.)
- **Evidência:** EVD-…-009/009b.
- **Reprovação:** sucesso sob entrada inválida.

### CA-04 — Fluxo legítimo executa auditoria real (integração E2E)
- **Entrada:** alvo com script `test` real (TST-04).
- **Esperado:** relatório contém evidência de execução do `npm run test` (state `PASS`); processo MCP exit 0.
- **Evidência:** EVD-…-005 (R01), EVD-…-010 (R02).
- **Reprovação:** checagem não executada / relatório sem evidência de execução.

### CA-05 — Sem regressões nos módulos impactados
- **Entrada:** suíte completa + typecheck (TST-05/TST-06).
- **Esperado:** `pass ≥ 172`, `fail = 0`, typecheck exit 0 (baseline EVD-…-008/007).
- **Evidência:** EVD-…-013 (falha intermediária preservada, fail 1) → EVD-…-017 (ajuste de contrato) → EVD-…-017b (172/0) e EVD-…-017c.
- **Reprovação:** novo `fail > 0` ou regressão de typecheck.

### CA-06 — Conformidade com o transporte stdio do MCP
- **Entrada:** alvo com scripts executáveis (produz log de progresso); `tools/call` (TST-07).
- **Esperado:** stdout **exclusivamente** JSON-RPC; `[EOS][CHECK]` **somente** em stderr.
- **Evidência:** EVD-…-005 (falha R01), EVD-…-010/011 (R02), EVD-…-015 (validador: 0 inválidas).
- **Reprovação:** qualquer linha não-JSON no stdout.

### CA-07 — Fluxo CLI preservado
- **Entrada:** `eos audit <alvo>` (TST-08).
- **Esperado:** execução sem exceção; sumário no stdout; exit code coerente com o veredito.
- **Evidência:** EVD-…-012b (sumário presente; exit 1 coerente com INSUFFICIENT_EVIDENCE do alvo-sonda).
- **Reprovação:** exceção não tratada ou ausência de sumário.

## Plano de testes

| Teste | Categoria | Critério | Procedimento | Evidência |
|---|---|---|---|---|
| TST-01 | Integração/E2E | CA-01 | smoke MCP scriptless | 003/004/016 |
| TST-02 | Estático/Contrato | CA-02 | inspeção + typecheck | 002/007/012/017c |
| TST-03 | Adversarial | CA-03 | path inexistente | 009/009b |
| TST-04 | Integração real | CA-04 | smoke MCP com script real | 005/010 |
| TST-05 | Regressão | CA-05 | suíte completa | 008/013/017b |
| TST-06 | Contrato | CA-05 | typecheck | 007/012/017c |
| TST-07 | Contrato de transporte | CA-06 | pureza JSONL do stdout | 005/010/011/015/016 |
| TST-08 | Ponta a ponta | CA-07 | CLI audit | 012b |

## Dispensas (aprovadas pelo auditor no parecer)

- **Concorrência:** não aplicável — canal MCP processa mensagem a mensagem; defeito não envolve corrida.
- **Ambiente real/representativo:** implícito — o runtime é o próprio ambiente de destino (stdio local).
