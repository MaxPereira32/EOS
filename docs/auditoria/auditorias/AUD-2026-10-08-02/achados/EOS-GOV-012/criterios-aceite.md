# EOS-GOV-012 / R01 — Critérios de Aceite (congelados antes da implementação)

> Cobre CA-14-02 e CA-14-06 da proposta §14. Evidência original: EVD-A1-EOS-GOV-012-001 (AUD-01, citada por referência).

### CA-012-01 — Artefatos ancorados ao projeto auditado
- **Entrada:** `executeAudit(targetPath)` sem `outputDir` explícito, executado de cwd diferente do alvo (TST-012-01).
- **Esperado:** canônico + arquivo por execução gravados em `<target.root_path>/.eos/…`; o cwd não recebe artefatos daquele alvo.
- **Reprovação:** qualquer artefato da execução gravado fora do alvo.

### CA-012-02 — Compatibilidade retroativa
- **Entrada:** `executeAudit(target, outDir)` com `outputDir` explícito (consumidores/testes existentes) (TST-012-02).
- **Esperado:** comportamento inalterado (usa exatamente o diretório informado).
- **Reprovação:** default sobrescrever o parâmetro explícito.

### CA-012-03 — Falha de armazenamento informada, sem sucesso artificial
- **Entrada:** caminho de arquivamento inviável (ex.: arquivo homônimo a `auditorias/`) (TST-012-03).
- **Esperado:** `executeAudit` rejeita (erro propagado); nenhum `identificacao.json` da execução é produzido; nenhum retorno de sucesso.
- **Reprovação:** resolução com relatório “de sucesso” apesar da falha de persistência.

### CA-012-04 — Sem regressões
- **Entrada:** suíte completa + typecheck (TST-012-04).
- **Esperado:** `fail = 0`; typecheck exit 0.
- **Reprovação:** qualquer novo `fail > 0`.
