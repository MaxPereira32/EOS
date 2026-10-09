# COR-01 / R01 — Implementação

- **Branch:** `fix/audit-p0`. **Base:** `93288df`.
- **Mudança:** `audit-application-service.ts` — `firestoreClaimDeclared` (claim `SEC-CLAIM-FIRESTORE-001` ou id com `FIRESTORE` ACTIVE em `eos.risk.yml`) condiciona `FirestoreDomainAdapter.discoverArtifacts` e `FirestoreSecurityEngine.evaluateRules`. Sem declaração: zero claims, zero findings Firestore. Motor preservado para alvos declarados.
- **Arquivos:** `EOS/core/services/audit-application-service.ts` (+17/-2 no diff total com COR-02).
- **Alternativa descartada:** remover o motor — amputaria feature de alvos que declaram; o fluxo declarado já é o contrato canônico.
