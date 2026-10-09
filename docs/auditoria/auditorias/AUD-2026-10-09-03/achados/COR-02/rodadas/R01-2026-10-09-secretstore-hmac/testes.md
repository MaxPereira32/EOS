# COR-02 / R01 — Testes

| Critério | Teste | Resultado |
|---|---|---|
| CA-02-01 | grep de literais no fonte | PASS (teste `report-integrity-signer.test.ts`) |
| CA-02-02 | sign + verify roundtrip via SecretStore | PASS |
| CA-02-03 | mutação aninhada invalida; ordem de chaves irrelevante | PASS (inclui 03b) |
| CA-02-04 | `audit .` pós-fix | PASS — `SECRET-001` em `report-integrity-signer.ts` eliminado; demais sinais intactos |
| CA-02-05 | store sem diretório gravável | PASS — falha na construção (fail-closed) |
| Regressão | `npm run test` + `tsc --noEmit` | 193/0/1 skipped; tsc limpo |

Evidências: `evidencias/EVD-A3-COR-02-001-testes-signer.txt` (+ `.eos/auditorias/RUN-3129f4c46ae5/`).
**Parecer independente: pendente.**
