# COR-01 — Critérios de aceite (pré-registrados)

| ID | Condição inicial | Ação | Resultado esperado | Verificação | Reprovação |
|---|---|---|---|---|---|
| CA-01-01 | Alvo com `firestore.rules`, sem claim FIRESTORE ACTIVE em `eos.risk.yml` | `audit` | Nenhum `SEC-CLAIM-FIRESTORE-001`, nenhum finding `EOS-DOM-*-FIRESTORE-*` | `auditoria.json`: `security_claims` e `findings` sem IDs Firestore | Qualquer claim/finding Firestore emitido |
| CA-01-02 | Idem | `audit` | `overall_phase_status` não é `BLOCKED` **por esse claim** (outros vereditos preservados, sem falso verde) | Regra `EOS-SECURITY-CLAIMS-001` + hard gate sem menção Firestore | `BLOCKED` sumir por supressão indevida de outro finding |
| CA-01-03 | Remoção aplicada | leitura | Aceite formal de risco registrado e datado | `aceite-risco-firestore.md` existe | Aceite ausente |
| CA-01-04 | Alvo com claim FIRESTORE ACTIVE declarado | `audit` | Avaliação legada executa como antes (comportamento preservado) | Teste de regressão com fixture declarada | Declaração ignorada |
