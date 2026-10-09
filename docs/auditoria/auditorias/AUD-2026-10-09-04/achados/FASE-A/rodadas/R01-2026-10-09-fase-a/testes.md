# FASE-A / R01 — Testes

| Critério | Resultado |
|---|---|
| CA-04-01/02 (4 testes CLI) | PASS (7/7 no trio de arquivos; 1 falha inicial era do harness — `execFileSync` sem shell no Windows — corrigida no teste, não no produto) |
| CA-08-01 | PASS |
| CA-05-01/02 | PASS |
| Regressão | `npm run test`: 202 testes, 201 PASS, 0 FAIL, 1 skipped (symlink/Windows, pré-existente); `tsc --noEmit` limpo |
| Auditoria real | `RUN-f7647b03fe78`: `GOVERNANCE-001` INSUFFICIENT→**PASS**, perfil `DECLARED_AND_INFERRED`; `report` reexibe o RUN (exit 1 coerente com RED remanescente do GENAI — escopo Fase B) |

**Parecer independente: pendente.**
