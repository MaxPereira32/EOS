# EOS-GOV-014 / R01 — Critérios de Aceite (congelados antes da implementação)

> Cobre CA-14-04 e CA-14-05. Fingerprint = SHA-256 truncado de `referência|localização` (regra/gate ou finding), estável entre execuções do mesmo projeto.

### CA-014-01 — Reocorrência vinculada ao histórico
- **Entrada:** duas execuções do mesmo alvo com um gate persistente não-PASS (ex.: `EOS-GOVERNANCE-001` INSUFFICIENT_EVIDENCE) (TST-014-01).
- **Esperado:** na execução 2, o registro de ocorrências (`gate_occurrences` em `identificacao.json`) contém o fingerprint com `previous_run_ids` incluindo a execução 1.
- **Reprovação:** reocorrência não vinculada, fingerprint instável ou vínculo apontando execução inexistente.

### CA-014-02 — Evidência histórica não é reutilizada como prova corrente
- **Entrada:** execução 2 após execução 1 (TST-014-02).
- **Esperado:** os artefatos da execução 2 têm hashes próprios (≠ execução 1); o vínculo com a execução 1 aparece somente como referência histórica; nenhum campo da execução 2 apresenta evidência da execução 1 como resultado atual.
- **Reprovação:** artefato/evidência copiado ou hash idêntico de artefato da execução 1 atribuído à execução 2.
