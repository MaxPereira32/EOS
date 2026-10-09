# AUD-2026-10-09-03 — Escopo

| Campo | Valor |
|---|---|
| **ID** | AUD-2026-10-09-03 (sequência A3) |
| **Data** | 2026-10-09 |
| **Branch** | `fix/audit-p0` (baseline `93288df65f4f3df8839e399bf5c2152e9be59fd5`, `main` == `origin/main`) |
| **Escopo** | COR-01 (claim Firestore condicionado à declaração; H1 = remover claim) + COR-02 (HMAC via SecretStore + canonicalização recursiva; H2 = OS_KEYCHAIN com desvio documentado) |
| **Executor** | opencode (implementação R01) |
| **Auditor** | independente, a designar (parecer em rodada própria) |
| **Critérios** | `achados/COR-01/criterios-aceite.md` (CA-01-01..03), `achados/COR-02/criterios-aceite.md` (CA-02-01..04) |

## Limitações

- `SecretStoreService` implementa apenas `PASSPHRASE_DERIVED`; não há integração OS keychain real (residual documentado na COR-02).
- Aceite formal de risco do Firestore (CA-01-03): `achados/COR-01/aceite-risco-firestore.md`.
