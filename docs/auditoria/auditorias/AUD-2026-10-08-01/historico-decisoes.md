# AUD-2026-10-08-01 — Histórico de Decisões (append-only)

Cada entrada registra: decisão, estado anterior → novo, data, responsável, justificativa, evidência e commit/versão.

## D-001 — Adoção da Diretriz como política do plano
- **Data:** 2026-10-08 · **Responsável:** opencode (executor)
- **Decisão:** `diretriz-governanca.md` passa a reger todo o processo de remediação (evidência > declaração; veredito por critério; auditoria independente).
- **Justificativa:** instrução formal do responsável pela decisão.
- **Evidência:** `docs/auditoria/diretriz-governanca.md`.
- **Estado anterior → novo:** plano declaratório (checklists preenchidos sem evidência) → plano executável e auditado.

## D-002 — Baseline reestabelecido por execução real
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** adotar `508581c` + estado do working tree como baseline; nenhuma correção presumida a partir do registro anterior.
- **Evidência:** EVD-A1-EOS-GOV-003-001 (git status/rev-parse/log/diff, versões, SO).
- **Estado anterior → novo:** estado presumido pelo relatório do agente → estado verificado por comandos reais.

## D-003 — Reclassificação do EOS-GOV-003
- **Data:** 2026-10-08 · **Responsável:** opencode (auditor da R01)
- **Decisão:** `Concluído (Aprovado)` (registro original) → `Em validação`.
- **Justificativa:** aprovação original declaratória (sem cadeia de evidências); reauditoria encontrou regressão de contrato MCP (CA-06) com reprodução real.
- **Evidência:** EVD-A1-EOS-GOV-003-005/006 (poluição de stdout), EVD-A1-EOS-GOV-003-002 (lacunas de registro).
- **Commit:** `508581c` (working tree).

## D-004 — Congelamento do contrato de aceite antes da R02
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** critérios CA-01…CA-07 congelados antes da implementação da iteração 2; CA-01…CA-05 formalizados post-hoc para R01 (limitação declarada).
- **Evidência:** `achados/EOS-GOV-003/criterios-aceite.md`.
- **Nota:** nenhum critério foi alterado após implementação (proibição de critérios retroativos preservada).

## D-005 — Veredito R01: REPROVADO (CA-06)
- **Data:** 2026-10-08 · **Responsável:** opencode (auditor)
- **Decisão:** abrir a correção nos termos da §9.1 da Diretriz.
- **Justificativa:** com scripts executáveis, o stdout do MCP recebeu 2 linhas não-JSON; stderr vazio; falha material do contrato de transporte.
- **Evidência:** EVD-005 (stdout), EVD-006 (stderr), EVD-015 (validador de pureza: 2 inválidas).
- **Parecer:** `achados/EOS-GOV-003/rodadas/R01-2026-10-08-remocao-mock/parecer.md`.

## D-006 — Reestruturação para isolamento por auditoria (auditoria-raiz)
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** adotar `auditorias/AUD-<ID>/` (uma pasta por auditoria) em lugar da estrutura por achado com nomes fixos; renomear evidências para `EVD-A1-…`; mover dossiês para dentro da auditoria corrente.
- **Justificativa (solicitação do responsável pela decisão):** a estrutura anterior permitia que uma segunda auditoria misturasse/sobrescrevesse registros.
- **Correção declarada de registro aberto (não encerrado):** o rascunho do `diagnostico.md` do GOV-003 continha (a) uma linha com atribuição incorreta de evidência (“EVD-014” para auditoria independente) e (b) texto estranho ao dossiê; ambos corrigidos no rascunho aberto. Nenhum registro encerrado foi alterado.
- **Evidência:** convenção em `docs/auditoria/README.md`; `registro-auditorias.md`.

## D-007 — Registro do achado EOS-GOV-011
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** registrar “execuções sucessivas sobrescrevem `.eos/auditoria.json`/`acf-auditoria.md`” como achado novo (P1, Média), com correção mecanicamente verificável (arquivo por execução).
- **Evidência:** EVD-A1-EOS-GOV-011-001 (2 execuções, mesmo caminho, hashes divergentes, sem histórico).

## D-008 — Ajuste de contrato do teste de observabilidade
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** spy de `console.log` → `console.error` em `EOS/tests/execution-observability.test.ts`, mantendo o intent do teste.
- **Justificativa:** o canal mudou por correção (CA-06); a falha da primeira execução fica preservada (EVD-013) e o ajuste é evidência de manutenção de contrato.
- **Evidência:** EVD-013 (fail 1), EVD-017 (diff), EVD-017b (172/0).

## D-009 — Escopo da verificação de baseline dos demais achados
- **Data:** 2026-10-08 · **Responsável:** opencode
- **Decisão:** re-verificar presença dos defeitos dos 8 achados no baseline; EOS-DET-009 permanece `Em análise` (reprodução pendente, limitação registrada).
- **Evidência:** evidências `EVD-A1-EOS-…-001` de cada achado.

## D-010 — Auditoria independente R02/GOV-011
- **Data:** 2026-10-08 · **Responsável:** responsável pela decisão (usuário)
- **Decisão:** submeter R02 (EOS-GOV-003) e a correção do EOS-GOV-011 a auditor independente (subagente), com reprodução própria dos testes críticos.
- **Evidência (a produzir):** transcrição da auditoria (EVD-A1-…-018) e pareceres R02 no dossiê.
- **Estado:** pendente de conclusão no fechamento desta auditoria.

## D-011 — Conclusão da auditoria independente: APROVADO (GOV-003 R02 e GOV-011 R01)
- **Data:** 2026-10-08 · **Responsável:** subagente auditor independente (transcrição por opencode)
- **Decisão:** aceitar os vereditos por critério e encerrar os dois achados como **Concluído** na revisão auditada.
- **Justificativa:** reprodução independente de CA-01..CA-07 (GOV-003) e CA-G11-01..05 (GOV-011); 32/32 hashes dos manifestos recalculados sem divergência; nenhuma divergência material com os dossiês; ressalvas declaradas (não execução pré-fix pelo auditor — corroborada por `git show HEAD`; colisão teórica de run_id; working tree não commitado).
- **Evidência:** EVD-A1-EOS-GOV-003-018 (transcrição integral) + pareceres de rodada.
- **Estado anterior → novo:** EOS-GOV-003 `Em validação` → `Concluído`; EOS-GOV-011 `Em validação` → `Concluído`.
- **Condição de persistência:** qualquer alteração posterior nos arquivos auditados invalida estas aprovações (§11) e exige reavaliação de impacto.

## D-012 — Regra global de registro/isolamento de auditorias + análise da proposta §14
- **Data:** 2026-10-08 · **Responsável:** responsável pela decisão (solicitou) + opencode (implementou a documentação)
- **Decisões:**
  1. A convenção de auditoria-raiz (ID/pasta por auditoria, rodadas imutáveis, evidências namespaced com manifesto) passa a valer como **regra global para qualquer projeto** — registrada em `C:\Users\lindo\.config\opencode\AGENTS.md` e detalhada em `docs/auditoria/README.md` (genérica).
  2. A proposta Codex §14 foi analisada (`proposta-item-14-analise-coerencia.md`): direção **coerente**, com 4 lacunas bloqueantes (L1=GOV-012, L2 identidade de achado, L3 índice atômico, L4 nomenclatura) e 2 dependências (D1=EOS-SEC-005, D2 origem de execução). **Implementação NÃO autorizada** nesta auditoria; fases F1–F4 a decidir.
  3. O EOS-GOV-011 (arquivamento por execução no `.eos`) é o instrumento já aprovado que sustenta a metade estrutural da proposta.
- **Evidência:** EVD-A1-EOS-GOV-012-001 (reprodução L1); AGENTS.md global (edição registrada em D-012, sem hash de commit — arquivo fora do repositório).
