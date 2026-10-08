# EOS-GOV-012 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-GOV-012 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Artefatos de auditoria ancorados ao cwd do processo, não ao projeto auditado |
| **Origem** | Análise de coerência da proposta Codex §14 (14.3/CA-14-02) + reprodução material |
| **Criticidade** | Alta — viola isolamento entre projetos: auditorias de projetos distintos executadas da mesma cwd compartilham o mesmo `.eos`; o projeto auditado pode nunca receber seus próprios registros |
| **Prioridade** | P1 |
| **Status** | Pendente (critérios de aceite obrigatórios antes de qualquer implementação — §5 da Diretriz) |
| **Executor** | — (não iniciado) |
| **Auditor** | — |
| **Baseline** | commit `508581c` + working tree (EVD-A1-EOS-GOV-003-001); reprodução em 2026-10-08 |
| **Arquivos afetados** | `EOS/core/services/audit-application-service.ts` (`executeAudit(targetPath, outputDir = '.eos')`; `outputDir` relativo ao cwd), `EOS/core/reporters/*` (caminhos derivados do outputDir) |

## Causa raiz

`executeAudit` deriva `outputDir` de um caminho relativo (`.eos`) resolvido pelo **cwd do processo**, em vez de ancorá-lo em `target.root_path`. Nenhum componente valida que o armazenamento pertence ao alvo.

## Impacto

1. **Mistura entre projetos** (viola CA-14-02 da proposta §14 e o princípio de isolamento).
2. Registros do projeto auditado podem ficar ausentes do próprio repositório/projeto.
3. O caminho canônico pode conter o relatório de outro alvo (observado: `EOS\.eos\auditoria.json` carregando alvo-sonda).

## Evidência (reprodução real)

- EVD-A1-EOS-GOV-012-001 — execução de `audit` do cwd `EOS` contra o alvo `eos-gov011-target`: `RUN-c4d937159005` / `TGT-ac52a7ad54bbe1b7` gravados em `EOS\.eos\auditoria.json`; `.eos` do alvo intacto (apenas runs anteriores).
- EVD-A1-EOS-GOV-012-001b/001c — stdout/stderr da execução.

## Limitações

- Reprodução local (Windows). O comportamento é determinístico pelo código (caminho relativo ao cwd), independente da plataforma.
- A correção depende de decisão da proposta §14 (F1 da análise de coerência): o contrato de aceite desta correção deve ser definido junto da implementação de auto-organização, com CA próprios + CA-14 relevantes.

## Dependências

- EOS-GOV-011 (arquivamento por execução) — já implementado e base para o layout `.eos/auditorias/<run_id>/`.
- Proposta §14 F1 (ancoragem + identidade + índice) — decisão do responsável pela decisão pendente.
