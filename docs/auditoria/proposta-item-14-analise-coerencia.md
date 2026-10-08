# Análise de Coerência — Proposta Codex §14 (Auto-organização de auditorias no EOS)

> Recebida em 2026-10-08 para verificação: “está coerente para uma implementação no EOS?”
> Método: confronto requisito-a-requisito com o código real (`EOS/core`) e com o que já foi implementado nesta auditoria (EOS-GOV-011 + convenção `docs/auditoria/README.md`). Referências de evidência: AUD-2026-10-08-01.

## Veredito

**Direção coerente e implementável — mas NÃO como “criar pastas”.** A proposta é compatível com a arquitetura do EOS e reutiliza mecanismos existentes, porém há **4 lacunas materiais** e **2 dependências** que precisam ser resolvidas antes de qualquer aprovação. Aprovar pela existência de diretórios violaria a Diretriz (§12): “a existência das pastas” não é prova.

## Requisito → realidade no EOS

| Requisito | Estado real | Classificação |
|---|---|---|
| 14.1 `auditRunId` único | **Já existe**: `RUN-<sha12>` derivado de seed com timestamp ISO | ✔ Reutilizar |
| 14.1 `projectId` estável | **Já existe**: `target.target_id` (`TGT-<hash>` por caminho raiz) | ✔ Reutilizar (limitação: copiar o repo muda o ID) |
| 14.1 origem da execução (CLI/MCP/API) | **Não registrada** no relatório | ✘ Aditivo pequeno |
| 14.1 commit/branch/estado do repo | `target.commit_hash/branch` no report (quando git) | ✔ Parcial |
| 14.2 estrutura por execução | **Parcial (EOS-GOV-011)**: `.eos/auditorias/<run_id>/{auditoria.json, acf-auditoria.md}` com imutabilidade provada (EVD-A1-EOS-GOV-011-002/003a/003b) | ✔ Adaptar nomes |
| 14.2 `indice-auditorias.json` | Não existe | ✘ Novo (com concorrência correta — L3) |
| 14.2 `identificacao.json` | Não existe (metadados estão dentro do report) | ✘ Novo (derivável do report) |
| 14.3 independência entre execuções do **mesmo** alvo | Provada pós-GOV-011 (hash da run 1 estável após run 2) | ✔ |
| 14.3 independência entre **projetos diferentes** | **FALHA**: `executeAudit(target, outputDir='.eos')` grava o `.eos` relativo ao **cwd do processo**, não ao alvo — dois projetos auditados da mesma cwd compartilham `./.eos` (ver EOS-GOV-012) | ✘ **L1 — Bloqueante para CA-14-02** |
| 14.4 reauditoria vinculada (novo/recorrente/corrigido/reaparecido) | `finding_id` atual é derivado por execução; não há fingerprint estável (ex.: `rule_id`+localização normalizada) | ✘ **L2 — design necessário** |
| 14.5 concorrência | Pastas por `run_id` não colidem na prática (seed ms; execução ≥100ms); índice read-modify-write seria corrida | ✘ **L3 — índice atômico** |
| 14.6 aplicabilidade global | EOS já roda por alvo; falta ancorar escrita ao alvo (L1) e prever storage externo | ✔ Parcial |
| 14.7 compatibilidade | Histórico local = apenas `.eos/auditoria.json` (sobrescrito até hoje) — sem perda a migrar; manter canônico como “última execução” | ✔ Fácil (documentar) |
| 14.8 hashes | `execution_evidences` já carregam SHA-256 de stdout/stderr; documentos não | ✔/✘ Aditivo |
| 14.8 autenticidade | `ReportIntegritySigner` tem HMAC com segredo hardcoded e serialização rasa (**EOS-SEC-005**, ainda aberto) | ✘ **D1 — dependência** |
| 14.9 CA-14-01..09 | Viáveis; CA-14-03 (simultâneas) exige teste de concorrência dedicado; CA-14-05 tem precedente forte (nonce RLS impede reuso — ver `rls-claim-engine`) | ✔ com testes novos |

## Lacunas materiais (bloqueantes da aprovação)

- **L1 — Ancoragem do armazenamento ao projeto auditado.** Hoje `outputDir` é relativo ao cwd. Sem corrigir, CA-14-02 (“projetos diferentes sem mistura”) é violado por construção. Registrado como achado **EOS-GOV-012** com reprodução material.
- **L2 — Identidade estável de achado.** Sem fingerprint (rule_id + localização canônica + artefato), não há como distinguir problema novo/recorrente/reaparecido nem vincular reocorrência ao achado original (14.4 / CA-14-04).
- **L3 — Índice sob concorrência.** `indice-auditorias.json` como arquivo único read-modify-write é corrida entre processos. Alternativa coerente: **append-only por auditoria** (uma linha/arquivo `registro.json` dentro de cada pasta de execução) + índice derivável por build/consulta — ou lock de arquivo com retry. Decidir antes de implementar.
- **L4 — Nomenclatura.** A proposta (`relatorio-auditoria.json/.md`, `audits/`, `achados/<findingId>/`) difere do que o EOS grava hoje (`auditoria.json`, `acf-auditoria.md`, `auditorias/`). O próprio 14.2 manda evitar duplicação: recomendação — **manter os nomes atuais como canônicos dentro da pasta da execução** e documentar o mapeamento (14.7), em vez de escrever dois conjuntos de arquivos.

## Dependências

- **D1 — EOS-SEC-005** (assinatura HMAC) deve ser corrigido antes de 14.8 “quando essa garantia for necessária”: assinatura atual não resiste a manipulação aninhada nem tem segredo protegido.
- **D2 — Origem da execução** (CLI/MCP/API) precisa ser injetada no contexto da auditoria para constar em `identificacao.json`.

## Coerência com o que já foi implementado (evitar duplicação)

- **EOS-GOV-011** já entrega a metade estrutural de 14.3 para execuções do mesmo alvo (pasta por `run_id`, imutabilidade provada com teste de regressão que falha no código antigo — EVD-GOV-011-003a/003b). A proposta §14 **estende**, não substitui.
- A convenção documental (`docs/auditoria/README.md`, auditoria-raiz com `AUD-<data>-<nn>`) já aplica no plano documental o princípio de unidade independente por auditoria; a implementação nativa do EOS deve espelhar essa semântica (identidade, isolamento, histórico).

## Plano de implementação sugerido (fases, cada uma com contrato de aceite e auditoria independente)

| Fase | Entrega | CA-14 cobertos | Evidência exigida |
|---|---|---|---|
| F1 | Ancoragem ao alvo (L1) + `identificacao.json` + origem da execução (D2) + índice append-only (L3) | CA-14-01/02/06/07/08 | teste de 2 projetos distintos da mesma cwd; falha de escrita não gera sucesso |
| F2 | Fingerprint de achado (L2) + vínculo de reocorrência no índice | CA-14-04 | reauditoria sintética do mesmo defeito → nova ocorrência vinculada |
| F3 | Hashes documentais + assinatura (após D1/EOS-SEC-005) | CA-14-05/08 | adulteração aninhada detectada; evidência antiga rejeitada como prova nova |
| F4 | Concorrência (CA-14-03) e storage externo (14.6) | CA-14-03/09 | teste de execuções simultâneas sem colisão |

## Conclusão

A proposta é **coerente com o EOS** e melhora o que existe, desde que: (1) corrija L1 (hoje violaria CA-14-02), (2) ganhe identidade de achado (L2), (3) trate concorrência do índice (L3), (4) adapte nomes sem duplicar (L4) e (5) respeite D1/D2. Nenhuma fase pode ser marcada “Concluída” por existência de pastas/arquivos — aprovação somente com os testes de 14.9 executados, resultados vinculados à versão e auditoria independente.

---

## Adendo 2026-10-08 — AUD-2026-10-08-02 (implementação autorizada F1+F2)

- **Status do item 14: ABERTO.** F1 (ancoragem/identificação/índice) e F2 (recorrência) implementados e testados na AUD-02; campanha específica executada por recomendação do responsável pela decisão: **dois projetos** auditados do mesmo cwd (cada um ancorado ao próprio `.eos`), **execuções simultâneas** (`Promise.all`, sem colisão) e **reauditoria** de problema persistente (vínculo `previous_run_ids`) — evidências EVD-A2-EOS-GOV-012-003 / 013-001 / 014-001.
- **Lacunas ainda abertas (exigidas para encerrar o item 14):**
  1. **F3 — assinatura/integridade documental (14.8):** bloqueada por EOS-SEC-005 (HMAC hardcoded + serialização rasa); após a correção, assinar relatórios/documentos e validar de forma independente.
  2. **L2 completa — identidade de achado:** fingerprint atual cobre `referência|localização`; falta distinguir novo/recorrente/corrigido/reaparecido com vínculo ao achado de origem entre auditorias.
  3. **L3 multi-processo:** concorrência testada apenas in-process; falta garantia/registro para execuções simultâneas em processos distintos.
  4. **L4 — nomenclatura:** mantidos os nomes canônicos (`auditoria.json`, `acf-auditoria.md`, `auditorias/`); falta formalizar o mapeamento para a nomenclatura da proposta §14.2 (`relatorio-auditoria.*`, `audits/<projectId>/`) ou decidir a renomeação.
  5. **Storage externo (14.6):** não implementado.
- **Encerramento do item 14** só ocorrerá com essas lacunas implementadas e nova campanha de aceitação (14.9 completa) + auditoria independente — conforme a recomendação.
