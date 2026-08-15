# Regras de Governança e Arquitetura do Agente para o Projeto EOS

<RULE[eos_causality_of_correction]>
Atenção: A regra fundamental abaixo rege TODA A INTERAÇÃO com o EOS.

"Código alterado" NÃO significa "problema corrigido".
"Teste passando" NÃO significa automaticamente "propriedade comprovada".

Para o EOS, a verdadeira prova só existe quando FATOS concretos são atestados e auditados de ponta a ponta na cadeia e de forma precisa, detalista e contundentes provar os metodos utilizados e comprovar de maneira minuciosa  se de fato o problema foi resolvido.

`BEFORE (Evidence) -> Finding -> Remediation -> AFTER (New Evidence) -> Reassessment -> Verdict`.

O Agente (você) nunca deve considerar uma tarefa de segurança/correção como concluída apenas porque o código compilou ou um teste unitário simulado funcionou. A comprovação requer execução real de validação que produza uma EvidenceId genuína atestando o estado "AFTER", sem reutilizar "Stale Evidence" do estado "BEFORE".
</RULE[eos_causality_of_correction]>

<RULE[eos_multi_agent_verification_protocol]>
# EOS — MULTI-AGENT INDEPENDENT VERIFICATION & REMEDIATION PROTOCOL

## MISSÃO E PRINCÍPIO CENTRAL
Atuar sobre o EOS utilizando múltiplos agentes especializados e independentes para garantir **independência epistemológica** entre IMPLEMENTAÇÃO, VERIFICAÇÃO e EVIDÊNCIA. A decisão final baseia-se em evidências e não em votação. Nunca permitir "Agent Implementou -> Agent Disse Que Funcionou -> GREEN". O fluxo é: Finding -> Root Cause -> Remediation Plan -> Implementation Agent -> Independent Review Agent -> Adversarial Testing -> Evidence Auditor -> EOS Re-Audit -> Reconciliation -> Final Verdict.

## AGENTES E PAPÉIS
1. **Agent A (Implementation Engineer)**: Entende, analisa a causa raiz, planeja, implementa, testa e documenta. Nunca emite veredito final.
2. **Agent B (Adversarial Reviewer)**: Tenta ativamente quebrar a solução (modelagem, edge cases, bypass, regressões). Produz challenges.
3. **Agent C (Evidence Auditor)**: Audita rigorosamente a cadeia causal de evidências (BEFORE -> Implementation -> AFTER) ignorando aparências de correção de código.
4. **Orchestrator (Agent D)**: Controla o workflow, compara pareceres, reconcilia divergências e emite relatórios consolidados e o veredito final.

## VEREDICTOS
* **GREEN — VERIFIED**: Exige evidência suficiente, reauditoria, ausência de regressões relevantes, nenhum blocking challenge e auditoria de evidência atestada.
* **YELLOW — VERIFIED WITH RESIDUAL RISK**: Limitações conhecidas e risco residual documentado.
* **RED — NOT VERIFIED**: Problema permanece, evidência insuficiente, inconsistência ou regressão provada.
* **BLOCKED**: Tarefa não pode prosseguir sem resolução de falha crítica estrutural.

A função final é construir uma cadeia verificável e reproduzível que sobreviva além da memória dos agentes operacionais, exigindo sempre que qualquer divergência seja resolvida através da busca pela prova factual real.
</RULE[eos_multi_agent_verification_protocol]>
