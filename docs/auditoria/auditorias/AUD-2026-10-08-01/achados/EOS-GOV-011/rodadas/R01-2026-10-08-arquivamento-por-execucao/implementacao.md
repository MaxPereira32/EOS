# EOS-GOV-011 / R01 — Implementação (executor: opencode)

## Problema a corrigir
Execuções sucessivas sobrescreviam `.eos/auditoria.json` e `.eos/acf-auditoria.md` (causa raiz: nomes fixos no diretório de saída; `audit_run_id` não utilizado no caminho) — EVD-A1-EOS-GOV-011-001.

## Solução proposta
Adicionar arquivamento por execução em `executeAudit`: após os artefatos canônicos, escrever **também** em `outputDir/auditorias/<audit_run_id>/{auditoria.json, acf-auditoria.md}` via os mesmos reporters (sem duplicação de lógica). O caminho canônico é mantido como “última execução” (compatibilidade CI/consumidores).

## Alternativas avaliadas
1. **Trocar o caminho canônico** por `auditorias/<run_id>/` — descartada: quebraria CI (`Verify Report Integrity`), CLI e consumidores existentes; exigiria migração imediata (proposta §14.7).
2. **Sufixo de timestamp no nome canônico** (ex.: `auditoria-<ts>.json`) — descartada: acumularia arquivos no diretório raiz e não criaria unidade por execução.

## Riscos
- Colisão de `run_id`: teórica (seed inclui ISO com ms; execução dura ≫1 ms) — registrada como limitação, sem teste dedicado (dispensa aprovada no contrato).
- Crescimento de disco: aceito; histórico é o objetivo.

## Arquivos alterados
| Arquivo | Alteração | Diff |
|---|---|---|
| `EOS/core/services/audit-application-service.ts` | bloco 9.1: arquivamento por execução | EVD-A1-EOS-GOV-011-006 |
| `EOS/tests/audit-archive.test.ts` | novo teste de regressão (CA-G11-01/02/03) | arquivo no repo |

## Plano de reversão
`git checkout -- EOS/core/services/audit-application-service.ts` + remover `EOS/tests/audit-archive.test.ts`. Atenção: o mesmo arquivo carrega a correção R02 do EOS-GOV-003 (não-commitada) — reversão seletiva exigiria reaplicar R02 (diff preservado em EVD-A1-EOS-GOV-003-014).

## Revisão submetida à auditoria
Working tree 2026-10-08, base `508581c`: os 3 arquivos das rodadas anteriores + `EOS/core/services/audit-application-service.ts` (bloco 9.1) + `EOS/tests/audit-archive.test.ts`.
