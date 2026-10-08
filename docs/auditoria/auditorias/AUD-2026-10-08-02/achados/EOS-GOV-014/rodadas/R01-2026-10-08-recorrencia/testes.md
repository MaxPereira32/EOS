# EOS-GOV-014 / R01 — Testes

Critérios: `../../criterios-aceite.md`. Campanha: EVD-A2-EOS-GOV-014-001.

| Teste | Critério | Procedimento | Observado | Exit | Evidência |
|---|---|---|---|---|---|
| TST-014-01 | CA-014-01 | 2 execuções do mesmo alvo; gate persistente `EOS-GOVERNANCE-001` (INSUFFICIENT_EVIDENCE) | execução 2 contém a ocorrência com `previous_run_ids=[RUN-0aa536fe1bee]` (execução 1); teste de suíte equivalente verde | 0 | EVD-…-001 §2 + suite |
| TST-014-02 | CA-014-02 | hashes dos artefatos das execuções 1 e 2 | `auditoria_json_sha256` da execução 2 **≠** da execução 1 (assert de suíte); vínculo com a 1 apenas via `previous_run_ids` | 0 | suite + EVD-…-001 |
| TST-014-01b | CA-014-01 | reauditoria via CLI (campanha §2) | vínculo correto mesmo entre execuções de interfaces iguais e projetos repostos | 0 | EVD-…-001 |

## Limitações registradas
- Fingerprint não distingue mudanças no artefato-fonte (apenas referência+localização) — declarado no contrato; evolução futura vinculada à identidade L2 completa (§14.4).
- Reauditoria de "problema corrigido e reincidente" (estados novo/recorrente/corrigido/reaparecido) fica limitada a recorrente/nova nesta fase.

## Pendência
Auditoria independente (parecer condicionado).
