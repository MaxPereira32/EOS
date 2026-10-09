# FASE-B / R01 — Implementação

- **COR-10:** `readContainerInternal` distingue ausente (gera) de ilegível (`CORRUPT_STORE_ERROR`, sem rotação). Migração legada sem versão preservada. Efeito colateral consciente: `getRegistryEntries` em store corrompido agora lança (fail-closed) em vez de lista vazia.
- **COR-11:** gate Firestore restrito a `SEC-CLAIM-FIRESTORE-001` exato; demais ids seguem a trilha declarada (fail-closed com motivos).
- **COR-03:** `validateIdParam` (tipo/tamanho ≤256/charset) em `id`/`projectId`/`providerId`; `apiKey` obrigatória ≤8192; `test-connection` sem provider → 400; desconhecido → 404 (era 500); CORRUPT nunca mapeado para 404 (mascararia adulteração). Bônus: `start()` resolve a porta atribuída (era a configurada — quebrava porta efêmera).
- **COR-06:** `supabaseUses` exige chamada de método/env (não menção ao pacote); `firebaseUses` exige import/init **e** uso (`collection/getDocs/getAuth/…`); localização RLS-002 aponta para uso. Auto-sinalizações eliminadas (engine:256, `rule-catalog`, `architecture-identity-engine`).
- **COR-07:** `REPLACE_WITH_*` no vocabulário de placeholder; linhas `type`/`interface` fora do detector de segredos.
- **COR-03b:** vocabulário de validação aceita `validate*()` (a validação real do boundary não era reconhecida).
- **Testes (1+ por correção):** `secret-store-corrupt` (3), `+CA-11-01`, `local-api-input-validation` (4), `rls-selfmatch` (4), `secret-precision` (2).
