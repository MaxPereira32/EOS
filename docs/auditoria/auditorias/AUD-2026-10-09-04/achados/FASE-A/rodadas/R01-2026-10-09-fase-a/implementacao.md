# FASE-A / R01 — Implementação

- **COR-04:** `printUsage()` lista `mcp/audit/orchestrate/nist-assess/report/fix`; novo `case 'report'` (reexibe `.eos/auditoria.json`, fail-closed sem auditoria, exit espelhado); script `graph` removido do `package.json` (`fix` mantido: comando desabilitado intencional com mensagem); README sincronizado. `graph` NÃO implementado: sem construtor honesto a partir de fonte/auditoria (mapear `Finding`→nós do `DomainGraphEngine` exigiria inventar `asset_id`/taxonomia) — remoção documentada em vez de meio-recurso.
- **COR-08:** `EOS/eos-version.md` sincronizado (v2.2.0, CLI v4.0.0, 2026-10-09 + linha no histórico; história anterior preservada).
- **COR-05:** `eos.risk.yml` versionado declarando `architecture.profile: cli-or-script` — idêntico à inferência da engine (0.90); sem `security_claims` (sem evidência = sem declaração).
- **Testes (1 por correção, exigência do usuário):** `cli-commands.test.ts` (4 casos: help, report fail-closed, report render, package.json), `version-manifest.test.ts` (versão do manifesto == pacote), `repo-governance.test.ts` (perfil declarado==inferido; `eos.risk.yml` da raiz).
