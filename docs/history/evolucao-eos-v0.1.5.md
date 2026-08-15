# Evolução Arquitetural — EOS v0.1.5

Este documento descreve as motivações, o escopo, as decisões técnicas e os impactos esperados relativos à evolução do **Engineering Operating System (EOS)** para a versão `v0.1.5`.

---

## 1. Motivo da Evolução

Na versão `v0.1.4`, introduzimos os prompts operacionais para direcionar a execução prática. No entanto, para garantir a governança rígida sobre o ciclo de vida de qualquer modificação, identificou-se a necessidade de formalizar o **Project Lifecycle Controller** como um protocolo central do framework. 

A meta da versão `v0.1.5` é estabelecer regras rígidas que impeçam suposições técnicas, controlem o escopo de forma estrita, exijam snapshots iniciais do projeto e obriguem o registro pós-implementação de aprendizados úteis no repositório consumidor.

---

## 2. Arquivos Adicionados e Alterados

* **Adicionado**: [EOS/protocolos/ciclo-engenharia.md](file:///c:/Users/USER/Desktop/DevJornay/Projeto/Cebus_Github/Engineering-Operating-System/EOS/protocolos/ciclo-engenharia.md)
  * *Objetivo*: Define o processo passo a passo do ciclo de vida, contendo as fases de snapshot inicial, classificação de demanda, análise de riscos e registro final de aprendizados.
* **Alterado**: [EOS/core/modelo-instancia.md](file:///c:/Users/USER/Desktop/DevJornay/Projeto/Cebus_Github/Engineering-Operating-System/EOS/core/modelo-instancia.md)
  * *Objetivo*: Inclui o snapshot de contexto e a pasta de aprendizados no inventário de arquivos obrigatórios da instância local (`.eos/`).
* **Alterado**: [EOS/README.md](file:///c:/Users/USER/Desktop/DevJornay/Projeto/Cebus_Github/Engineering-Operating-System/EOS/README.md)
  * *Objetivo*: Atualiza a versão do framework para `v0.1.5` e insere o novo protocolo no diagrama de árvore física de diretórios.

---

## 3. Decisões Técnicas Tomadas

1. **Adoção da Fase Zero (Snapshot)**: Impõe-se que nenhum código seja analisado ou tocado sem a criação de um snapshot estático inicial (`.eos/contexto/snapshot-inicial.md`) descrevendo fatos confirmados do projeto, protegendo a equipe técnica contra suposições.
2. **Classificação e Controle de Escopo**: Todas as demandas passam a ser classificadas em Correção, Evolução, Refatoração ou Mudança Arquitetural, contendo limites claros de arquivos dentro e fora do escopo.
3. **Registro de Aprendizados**: Exige-se que toda conclusão de tarefa grave lições aprendidas em `.eos/aprendizados/` para preservar o conhecimento e evitar erros recorrentes no time.

---

## 4. Impacto Esperado

* **Rastreabilidade e Prevenção de Risco**: Maior controle sobre o impacto de alterações arquiteturais críticas de nível médio ou alto.
* **Preservação de Histórico Operacional**: O histórico de decisões (ADRs) agora é complementado com o diário de aprendizados físicos do time de engenharia.
