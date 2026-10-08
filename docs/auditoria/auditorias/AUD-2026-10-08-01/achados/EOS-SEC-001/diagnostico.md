# EOS-SEC-001 — Diagnóstico

| Campo | Valor |
|---|---|
| **ID** | EOS-SEC-001 |
| **Auditoria** | AUD-2026-10-08-01 |
| **Título** | Publicação do diretório `.eos/` integral como artefato de CI (exposição de material sensível) |
| **Origem** | Auditoria de origem (plano Codex §2) + re-verificação de baseline |
| **Criticidade** | Crítica (potencial) — `.eos` contém `machine.key`, `machine.salt`, `credentials.enc.json`, `session.token`; upload integral expõe material sensível a qualquer consumidor do artefato |
| **Prioridade** | P0 |
| **Status** | Pendente |
| **Executor / Auditor** | — / — |
| **Baseline** | `508581c` + working tree |
| **Arquivos afetados** | `.github/workflows/eos-audit.yml:49-53` (upload de `path: .eos/`) |

## Causa raiz

O passo de publicação usa o diretório inteiro (`.eos/`) como caminho do artefato, sem allowlist de arquivos higienizados/assinados.

## Impacto

- Vazamento de chaves/tokens locais via artefato de CI (retenção conforme política do repositório).
- Interage com EOS-CI-008 (upload também do snapshot não assinado) e com a higiene local (`machine.key` presente no `.eos` do repositório — ver EVD de baseline).

## Evidência

- EVD-A1-EOS-SEC-001-001 — listagem real de `.eos` (machine.key, machine.salt, credentials.enc.json, session.token, entre outros) + referência ao passo de upload.

## Limitações
- Dry-run de upload no GitHub Actions não executado localmente (ambiente externo); comprovação estática do YAML + inventário local do diretório são suficientes para confirmar o defeito. O critério de aceite deverá incluir inspeção do pacote produzido (allowlist) e ausência dos arquivos sensíveis.
