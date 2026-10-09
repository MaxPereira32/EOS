# COR-01 — Diagnóstico

| Campo | Valor |
|---|---|
| **Achado(s)** | ACH-01 (`SEC-CLAIM-FIRESTORE-001` SIMULATION_ONLY → `BLOCKED`; finding `EOS-DOM-CLAIM-FIRESTORE-001-1`) |
| **Origem** | `RUN-c1f63e327249` (2026-10-09) + decisão H1 (remover claim) |
| **Arquivos** | `EOS/core/services/audit-application-service.ts:979-1011` (adapter + engine legada), `EOS/core/engines/firestore-security-engine.ts` (preservado) |

## Causa raiz

Duas fontes emitem claim Firestore para **qualquer alvo** com `firestore.rules`, sem opt-in: `FirestoreDomainAdapter` (envelopes → findings `EOS-DOM-*`) e `FirestoreSecurityEngine` legada (`SEC-CLAIM-FIRESTORE-001`). Alvo sem teste `@firebase/rules-unit-testing` (ex.: o próprio EOS) recebe `BLOCKED` permanente, sem caminho de remediação. O fluxo declarado (`eos.risk.yml` → `EOS-SECURITY-CLAIMS-001`) já é o contrato canônico; o legado auto-emitido o contradiz.
