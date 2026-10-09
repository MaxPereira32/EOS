# COR-01 / R01 — Testes

| Critério | Teste | Resultado |
|---|---|---|
| CA-01-01 | `firestore-claim-declaration-gate.test.ts` (fixture sem declaração) | PASS — 0 claims, 0 findings Firestore |
| CA-01-02 | idem (rationale sem FIRESTORE; outros vereditos intactos) | PASS |
| CA-01-03 | `aceite-risco-firestore.md` existe e datado | PASS (leitura) |
| CA-01-04 | fixture com `SEC-CLAIM-FIRESTORE-001` ACTIVE | PASS — claim avaliado |
| Regressão | `npm run test` (194 testes) | 193 PASS, 0 FAIL, 1 skipped (symlink/Windows, pré-existente) |
| Estático | `npx tsc --noEmit` | limpo |
| Pós-fix real | `npx tsx EOS/bin/eos.ts audit .` → `RUN-3129f4c46ae5` | claims Firestore: 0; findings 7→5; `BLOCKED`→`RED` (GENAI FAIL remanescente, fora do escopo) |

Evidências: `evidencias/EVD-A3-COR-01-001-testes-gate.txt`, `EVD-A3-COR-01-002-auditoria-pos-fix.txt` (+ `.eos/auditorias/RUN-3129f4c46ae5/`).
**Parecer independente: pendente.**
