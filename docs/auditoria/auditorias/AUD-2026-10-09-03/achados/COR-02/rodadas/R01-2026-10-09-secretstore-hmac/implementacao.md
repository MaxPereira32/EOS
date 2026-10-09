# COR-02 / R01 — Implementação

- **Branch:** `fix/audit-p0`. **Base:** `93288df`.
- **Mudança 1:** `report-integrity-signer.ts` reescrito — chave HMAC como credencial `EOS_REPORT_SIGNING` no `SecretStoreService` (gerada uma vez via `randomBytes(32)`, cifrada em repouso, raiz na instalação do EOS, nunca no alvo); canonicalização recursiva (`canonicalize`); `verify` com `timingSafeEqual`; fail-closed (lança sem segredo válido).
- **Mudança 2:** `SecretStoreService` aceita `rootDir` opcional (default `process.cwd()` — compatível).
- **Desvio de H2:** sem integração OS keychain real; `storeType` permanece `PASSPHRASE_DERIVED` (machine.key 0600). Residual explícito.
