# Regras de Governança e Arquitetura do Agente para o Projeto EOS

<RULE[eos_causality_of_correction]>
Atenção: A regra fundamental abaixo rege TODA A INTERAÇÃO com o EOS.

"Código alterado" NÃO significa "problema corrigido".
"Teste passando" NÃO significa automaticamente "propriedade comprovada".

Para o EOS, a verdadeira prova só existe quando FATOS concretos são atestados e auditados de ponta a ponta na cadeia e de forma precisa, detalista e contundentes provar os metodos utilizados e comprovar de maneira minuciosa  se de fato o problema foi resolvido.

`BEFORE (Evidence) -> Finding -> Remediation -> AFTER (New Evidence) -> Reassessment -> Verdict`.

O Agente (você) nunca deve considerar uma tarefa de segurança/correção como concluída apenas porque o código compilou ou um teste unitário simulado funcionou. A comprovação requer execução real de validação que produza uma EvidenceId genuína atestando o estado "AFTER", sem reutilizar "Stale Evidence" do estado "BEFORE".
</RULE[eos_causality_of_correction]>
