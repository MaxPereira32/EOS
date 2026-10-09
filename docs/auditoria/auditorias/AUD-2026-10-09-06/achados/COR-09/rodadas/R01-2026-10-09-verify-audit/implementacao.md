# COR-09 / R01 — Implementação

- **`eos verify-audit <AUD-ID> [repo] [--since <sha>]`:**
  1. Recomputa SHA-256 de cada entrada de cada `MANIFEST.md` (formatos 2 e 3 colunas); ausente/divergente → `HASH DIVERGENTE`/`AUSENTE` + exit 1.
  2. Com `--since`: `git diff --name-only <sha> HEAD -- <aud-dir>`; qualquer mudança → exit 1 ("exige nova rodada").
  3. Sem `--since`: trava não aplicável (informado, não silencioso). Leitura pura, sem escrita.
- **Remoção Firebase:** `git rm firebase.json firestore.rules` (commit separado). Motivo: sem app (`Age/apps/web-app` inexistente), sem `.firebaserc`, sem SDK — vínculo só configuracional; regra sem deploy é fronteira de segurança fictícia. Motores/adapters preservados (capacidade do produto p/ outros alvos).
- **Testes:** `verify-audit.test.ts` (CA-09-01..04: íntegro aprova; adulterado/ausente reprova; `--since` limpo aprova e sujo reprova em repo git temporário; AUD inexistente falha fechado).
