# EOS-GOV-014 / R01 — Implementação (executor: opencode)

Específicos deste achado (mesmo conjunto de arquivos das rodadas R01 do GOV-012/013 — ver diffs EVD-A2-…-004/004b):

- `AuditRegistryService.computeGateFingerprint(reference, location?)` = SHA-256 truncado de `referência|localização` — estável entre execuções do mesmo projeto.
- Coleta de gates por execução: `rule_results` não-PASS/não-NOT_APPLICABLE (`reference = rule_id`) + `findings` (`reference = rule_id`, `location`) — persistida em `gate_occurrences` dentro do `identificacao.json`.
- `computeOccurrences(outputDir, runId, gates)`: cruza fingerprints com o histórico **persistido** das execuções anteriores e registra `previous_run_ids` — o vínculo de reocorrência (CA-14-04).
- Anti-reuso (CA-14-05): cada execução produz `artifacts.auditoria_json_sha256` próprio; o histórico da anterior aparece apenas como referência (`previous_run_ids`), nunca como resultado corrente.

Limitações declaradas: fingerprint por `referência|localização` (não inclui hash do artefato-fonte). Reversão: ver GOV-012.
