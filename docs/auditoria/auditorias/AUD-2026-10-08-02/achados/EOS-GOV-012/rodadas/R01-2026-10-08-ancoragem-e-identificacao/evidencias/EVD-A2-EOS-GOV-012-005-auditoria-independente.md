# EVIDENCIA EVD-A2-EOS-GOV-012-005 — Transcrição da Auditoria Independente (AUD-2026-10-08-02)

- Auditor: subagente opencode independente (não é o executor).
- Data/hora: 2026-10-08 11:27:34 −03:00 (America/Sao_Paulo).
- Revisão auditada: `508581c1897172299fb0bc3b8a9e75e0c77c98d6` + working tree; `git status --short`: M EOS/bin/eos.ts, M EOS/core/platform/eos-mcp-server.ts, M EOS/core/services/audit-application-service.ts, M EOS/tests/execution-observability.test.ts, ?? EOS/core/services/audit-registry-service.ts, ?? EOS/tests/audit-archive.test.ts, ?? EOS/tests/audit-registry.test.ts, ?? docs/auditoria/.
- Ambiente: Windows 11 Pro build 26200; PowerShell 5.1.26100.9444; Node v24.19.0; npm 11.17.0; tsx v4.23.12.
- Artefatos do auditor: `C:\Users\lindo\AppData\Local\Temp\opencode\auditor-sub2\` (logs, scripts, alvos A–D, `aud2-evidence-sha256.txt`); nenhum arquivo do repositório alterado.

## Relatório (transcrição fiel)

### Baseline HEAD (prova anti-cosmética)
- `git show HEAD:...audit-application-service.ts | Select-String "AuditRegistryService|effectiveOutputDir|hrtime"` → **nada**; `Select-String "outputDir: string = '.eos'"` → **presente**; `HEAD:eos.ts` sem `interface: 'CLI'`.

### Por critério

| Critério | Veredito | Resultado observado |
|---|---|---|
| CA-012-01 | APROVADO | A: `RUN-df09345081ae`, root_path=A; B: `RUN-5332258819a1`, root_path=B; `.eos\auditorias\<run>` em cada alvo; EOS `.eos` 22 arquivos, 0 divergências, canônico `B7D0C9DF…` inalterado |
| CA-012-02 | APROVADO | 179 pass/0 fail; runs com outDir explícito não vazaram para os alvos |
| CA-012-03 | APROVADO | `resolved=false`; `error=ENOTDIR … mkdir '…\failout\auditorias\RUN-0af34affaf36'`; `identificacao_encontrados=0` (canônico já gravado antes da falha — parcial, sem declaração de sucesso) |
| CA-012-04 | APROVADO | `tests 180, pass 179, fail 0, skipped 1`, exit 0; tsc exit 0 |
| CA-013-01 | APROVADO | campos completos; `project_id=PRJ-a2be10fd4750ad0a` estável; `interface=CLI`; hash `5d555082…` = recalculado |
| CA-013-02 | APROVADO | A: 2 = pastas = índice; B: 1 = 1 = 1 |
| CA-013-03 | APROVADO | run 1: 3 arquivos inalterados, 0 divergências |
| CA-013-04 | APROVADO | N=2: runs distintos 2/2, índice 2; N=5: 5 run_ids, 5 pastas, `omitidas_no_indice=0` |
| CA-013-05 | APROVADO | índice × pastas × listAudits idênticos; derivável por scan |
| CA-014-01 | APROVADO | `EOS-GOVERNANCE-001` fingerprint `fdbfa183454e78fe` estável; run 2 `previous_run_ids=[RUN-df09345081ae]` |
| CA-014-02 | APROVADO | hashes run1 ≠ run2; SHA-256 da run 1 dentro do relatório da run 2 = **0 ocorrências**; vínculo só via `previous_run_ids` |

### Integridade dos manifestos (item 8)
- Na execução do auditor: **0/3 MANIFEST.md** em AUD-02 → item INCONCLUSIVO por ausência documental (ressalva de encerramento). Hashes independentes dos 7 arquivos EVD-A2-* registrados em `aud2-evidence-sha256.txt`:
  - 012-001 → `9BA5148C034B91ADD26B1213DEA96D79F89EF958ABA2FAA7345E52899FAABA85`
  - 012-002 → `69045F283DD1CD2DBB5C19BDDC3660E6C029ADD2AD239BCE59B9FC570F47E837`
  - 012-003 → `7460BCB94E6909EBC6FFF9999D4AC69D450D584F661E0AD1C5E1C22F92B57372`
  - 012-004 → `8A0899C528D02EFEACCFA66445D9C4EFFF8CAF4F02DB725D65112A5EE3661D8D`
  - 012-004b → `4304428A141B45106860E24D978A0A1AF16FBDE51E205121EDE2DAF6F7C4D71D`
  - 013-001 / 014-001 → `7460BCB9…` (idêntico ao 012-003)
- Confrontos: patch EVD-004 byte-equivalente ao `git diff` real (10 612 bytes); tail da suíte confere com a execução do auditor.

### Divergências
1. Ausência de MANIFEST.md nas 3 rodadas (violação §7.3; impediu o item 8) — **regularizada após o parecer**: manifestos criados com SHA-256 e reuso declarado; hashes conferidos contra a lista independente `aud2-evidence-sha256.txt` (0 divergências).
2. Evidências bit-idênticas (campanha replicada em 013/014) — reuso **declarado** nos manifestos e nos pareceres.
3. `implementacao.md` do GOV-012 dizia “3 arquivos rastreados” — corrigido para 4 (inclui `execution-observability.test.ts`, da AUD-01).
4. Ambiguidade de caminho “EOS\.eos” — esclarecido: canônico verificado = `<raiz repo>\.eos\auditoria.json`.

### Riscos residuais
Índice sem transação multi-processo (limitação declarada); fingerprint sem hash do artefato-fonte (declarado); working tree não commitado; falha de armazenamento deixa canônico parcial (sem identificação/sucesso — atende CA-012-03).

### Não verificado
Conteúdo tabelado dos manifestos (inexistentes à época); MCP ponta a ponta (interface verificada por inspeção/typecheck/suíte); concorrência multi-processo; campanha original reexecutada (reprodução própria equivalente A–D); commit/branch reais (alvos não-git, null explícito).

### PARECER FINAL
- **EOS-GOV-012 — APROVADO.** CA-012-01..04 por execução própria.
- **EOS-GOV-013 — APROVADO.** CA-013-01..05 por execução própria.
- **EOS-GOV-014 — APROVADO.** CA-014-01..02 por execução própria.
- **Ressalva de encerramento:** bloqueado até regularização documental (MANIFEST.md nas 3 rodadas com reuso declarado) — **atendida em 2026-10-08** com conferência de hashes contra `aud2-evidence-sha256.txt`.
