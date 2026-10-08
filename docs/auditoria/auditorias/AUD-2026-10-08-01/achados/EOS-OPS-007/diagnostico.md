# EOS-OPS-007 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-OPS-007 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Submódulo Git `Age` sem mapeamento válido (clone/CI quebram) |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Média/Alta — quebra de reprodutibilidade do repositório em clone limpo |
| **Prioridade** | P1 |
| **Status** | Pendente |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `.gitmodules` (ausente), diretório `Age/`, `firebase.json` (aponta para `dist` — verificar na correção) |

## Causa raiz

O git index / configuração de worktree referencia `Age` como submódulo, mas não existe `.gitmodules` com o mapeamento — qualquer operação de submódulo falha com erro fatal.

## Impacto

- `git submodule status`/`update` falham; clones/CI que executem operações de submódulo quebram.
- Referências ao conteúdo de `Age` (skills agentivas) ficam sem proveniência definida.

## Evidência (reprodução real)

- EVD-A1-EOS-OPS-007-001 — `git submodule status` → `fatal: no submodule mapping found in .gitmodules for path 'Age'` (exit ≠ 0); `Test-Path .gitmodules` → `False`.

## Limitações
- A decisão de correção (restaurar `.gitmodules` com URL válido vs. remover o vínculo e absorver o diretório) é de arquitetura; critérios de aceite devem fixar a decisão antes de implementar.
