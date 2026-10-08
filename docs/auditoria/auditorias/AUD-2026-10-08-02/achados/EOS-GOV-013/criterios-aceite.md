# EOS-GOV-013 / R01 — Critérios de Aceite (congelados antes da implementação)

> Cobre CA-14-01, CA-14-03, CA-14-07, CA-14-08. Precedente: EOS-GOV-011 (arquivamento) aprovado na AUD-01.

### CA-013-01 — Identificação automática por execução
- **Entrada:** uma execução com interface declarada (`CLI` ou `MCP`) (TST-013-01).
- **Esperado:** `auditorias/<run_id>/identificacao.json` contém: `audit_run_id`; `project.project_id` (hash estável por caminho); `target_id`; `root_path`; `commit_hash`/`branch`; `timestamp` ISO; `executor`; `interface`; `eos_version`; `scope`; `environment`; `status`; `artifacts.auditoria_json_sha256` correspondente ao arquivo real.
- **Reprovação:** campo obrigatório ausente, interface incorreta ou hash divergente do artefato.

### CA-013-02 — Histórico consultável a partir de registros persistidos
- **Entrada:** duas execuções do mesmo projeto; consulta via listagem (TST-013-02).
- **Esperado:** listagem retorna exatamente as execuções persistidas (2), ordenadas por timestamp, lidas de `identificacao.json` (não de cache).
- **Reprovação:** contagem/IDs divergentes dos registros reais.

### CA-013-03 — Execução anterior preservada
- **Entrada:** duas execuções consecutivas (TST-013-03).
- **Esperado:** documentos/evidências da execução 1 inalterados (hash estável); consulta à execução 1 continua retornando seus dados originais.
- **Reprovação:** qualquer alteração retroativa.

### CA-013-04 — Auditorias simultâneas sem colisão
- **Entrada:** duas execuções concorrentes no mesmo projeto (Promise.all) (TST-013-04).
- **Esperado:** `run_id`s distintos; duas pastas de execução válidas; nenhuma sobrescrita entre arquivos por execução.
- **Reprovação:** colisão de `run_id`/pasta ou perda de registro.

### CA-013-05 — Índice derivado consistente
- **Entrada:** após N execuções, leitura do `indice-auditorias.json` e reconstrução por scan (TST-013-05).
- **Esperado:** índice (se materializado) contém exatamente as N execuções; é regenerável por scan sem perda (a verdade é por execução).
- **Reprovação:** índice apresentar execuções inexistentes ou omitir execuções persistidas.
