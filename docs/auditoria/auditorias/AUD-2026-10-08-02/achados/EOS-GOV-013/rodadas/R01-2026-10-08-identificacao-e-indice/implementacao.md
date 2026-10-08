# EOS-GOV-013 / R01 — Implementação (executor: opencode)

Alterações compartilhadas com a rodada R01 do EOS-GOV-012 (mesmo conjunto de arquivos — ver `../../../EOS-GOV-012/rodadas/R01-2026-10-08-ancoragem-e-identificacao/implementacao.md` e diff EVD-A2-…-004). Específicos deste achado:

- `identificacao.json` por execução (`auditorias/<run_id>/`): `audit_run_id`, `project` (`project_id` estável por caminho + `target_id`/`root_path`/`repository`/`commit_hash`/`branch`), `timestamp`, `executor`, `interface` (CLI/MCP/API/UNKNOWN), `eos_version`, `scope`, `environment`, `status`, `artifacts` (com SHA-256 do `auditoria.json` arquivado).
- `AuditRegistryService.listAudits(outputDir)`: histórico lido **dos registros persistidos** (`identificacao.json`), ordenado por timestamp — não de cache.
- `indice-auditorias.json`: **índice derivado** (regenerável por scan), escrito de forma atômica (tmp com sufixo único + rename com fallback); a verdade permanece por execução.
- Injeção de interface: `bin/eos.ts` → `CLI`; `eos-mcp-server.ts` → `MCP`; chamadas programáticas → `UNKNOWN` ou explícito (campanha usou `API`).
- `run_id` com componente monotônico (`process.hrtime.bigint()`) — elimina a colisão teórica registrada na AUD-01.

Riscos: crescimento do diretório `.eos/auditorias/` (aceito; histórico é o objetivo). Reversão: ver GOV-012.
