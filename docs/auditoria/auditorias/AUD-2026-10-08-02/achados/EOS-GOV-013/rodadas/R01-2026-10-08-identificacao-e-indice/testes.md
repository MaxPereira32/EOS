# EOS-GOV-013 / R01 — Testes

Critérios: `../../criterios-aceite.md`. Campanha: EVD-A2-EOS-GOV-013-001.

| Teste | Critério | Procedimento | Observado | Exit | Evidência |
|---|---|---|---|---|---|
| TST-013-01 | CA-013-01 | suíte: execução com interface `CLI`; leitura do `identificacao.json` | todos os campos presentes; `interface=CLI`; `executor=EOS AuditApplicationService`; `eos_version=2.2.0`; **hash do artefato confere** com o arquivo real | 0 | EVD-A2-EOS-GOV-012-001 (suite) |
| TST-013-01b | CA-013-01 | campanha: interface `CLI` e `API` | `interface x2 = CLI`; simultâneas `API`; `project_id=PRJ-0af84e5a3ba80440` estável entre execuções | 0 | EVD-…-001 §2/§3 |
| TST-013-02 | CA-013-02 | 2 execuções; listagem + índice | listagem = exatamente 2 runs persistidas; `indice-auditorias.json` com 2 entradas; projY com 1 | 0 | suite + EVD-…-001 §1 |
| TST-013-03 | CA-013-03 | hash da run 1 antes/depois da run 2 | **inalterado** (`True` na campanha §2); testes `audit-archive` permanecem verdes | 0 | EVD-…-001 §2 |
| TST-013-04 | CA-013-04 | `Promise.all` — 2 execuções simultâneas no mesmo projeto | `run_id`s distintos (`RUN-68ae17b0824a` / `RUN-f7ec80baf7fc`); 2 pastas válidas; contagens 3/2 coerentes | 0 | EVD-…-001 §3 + suite |
| TST-013-05 | CA-013-05 | índice vs. scan | índice contém exatamente as execuções persistidas; reconstrução por scan idêntica (derivado) | 0 | suite |

## Pendência
Auditoria independente (parecer condicionado).
