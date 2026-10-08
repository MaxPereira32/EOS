# EOS-GOV-012 / R01 — Implementação (executor: opencode)

## Alterações efetuadas (AUD-02)

| Arquivo | Alteração | Evidência |
|---|---|---|
| `EOS/core/services/audit-registry-service.ts` (novo) | `AuditRegistryService`: `project_id` estável por caminho; `identificacao.json` por execução; listagem (verdade = por execução); índice derivado atômico; fingerprints e ocorrências | EVD-A2-…-004b |
| `EOS/core/services/audit-application-service.ts` | `executeAudit(target, outputDir?, context?)`: default ancorado a `target.root_path/.eos`; `run_id` com `hrtime` (sem colisão); bloco 9.2 (identificação + índice; falha propaga) | EVD-A2-…-004 |
| `EOS/bin/eos.ts` | interface `CLI`; caminhos gerados impressos a partir de `report.target.root_path` | EVD-A2-…-004 |
| `EOS/core/platform/eos-mcp-server.ts` | interface `MCP` | EVD-A2-…-004 |
| `EOS/tests/audit-registry.test.ts` (novo) | 6 testes de contrato/regressão (âncora, identificação, histórico, recorrência, falha de armazenamento, concorrência) | EVD-A2-…-004b |

## Justificativa técnica
O armazenamento pertencia ao cwd (defeito EVD-A1-EOS-GOV-012-001, AUD-01). A ancoragem ao alvo elimina a mistura entre projetos (CA-14-02); a falha de persistência propaga erro (CA-14-06); compatibilidade mantida quando `outputDir` é explícito (consumidores e testes existentes).

## Alternativas avaliadas
- **Manter default `.eos` e exigir cwd do alvo no operador** — descartada: dependência de disciplina do operador; a classe de defeito permaneceria.
- **Duplicar gravação (cwd + alvo)** — descartada: perpetua artefatos fora do alvo e duplica estado.

## Riscos
- Consumidores que chamavam `executeAudit(target)` contando com cwd passam a ter artefatos no alvo — é o comportamento correto do CA-14-02; CI (target `.`) é idêntico (root_path = cwd), verificado na análise de impacto.
- Working tree não commitado (AUD-01 + AUD-02) — risco declarado.

## Plano de reversão
`git checkout -- EOS/core/services/audit-application-service.ts EOS/bin/eos.ts EOS/core/platform/eos-mcp-server.ts` + remover os 2 arquivos novos. Atenção: o service carrega também AUD-01 (GOV-003/GOV-011 não commitados) — diff preservado em EVD-A1-…-002/014/006 e EVD-A2-…-004.

## Mudanças fora do escopo previsto
Nenhuma. F3 (assinatura/14.8) permanece bloqueada (EOS-SEC-005); storage externo e renomeação (L4) fora do escopo autorizado.

## Revisão submetida à auditoria
Working tree 2026-10-08 sobre `508581c` (inclui AUD-01): **4 arquivos rastreados modificados** (`EOS/bin/eos.ts`, `EOS/core/platform/eos-mcp-server.ts`, `EOS/core/services/audit-application-service.ts`, `EOS/tests/execution-observability.test.ts` — este último da AUD-01/R02) + novos `audit-archive.test.ts`, `audit-registry.test.ts` + `docs/auditoria/`. (Correção de precisão após observação do auditor independente; sem impacto no código.)
