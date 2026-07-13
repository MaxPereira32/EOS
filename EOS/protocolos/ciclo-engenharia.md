# Protocolo de Ciclo de Engenharia — EOS

Este protocolo orienta o ciclo de vida completo de modificações de software de qualquer projeto sob a governança do **Engineering Operating System (EOS)**, conforme definido no **Project Lifecycle Controller — EOS v0.1.5**. Ele estabelece as fases obrigatórias de preparação, análise, execução, validação e arquivamento de aprendizados.

---

## 1. O Fluxo de Ciclo de Vida do Projeto

Toda modificação técnica no repositório consumidor deve seguir as fases consecutivas descritas a seguir:

```
[ Fase Zero: Snapshot ] ──► [ Classificação e Escopo ] ──► [ Análise de Risco & ADR ]
                                                                     │
                                                                     ▼
[ Aprendizado e Fechamento ] ◄── [ Validação Final ] ◄── [ Execução Incremental ]
```

---

## 2. Fase Zero — Snapshot Inicial

Antes de executar qualquer análise ou modificação física de arquivos, o desenvolvedor ou agente deve registrar uma foto estática do estado do projeto.
* **Localização**: `.eos/contexto/snapshot-inicial.md`
* **Informações Obrigatórias**:
  * **Identificação**: Nome do projeto, versão, objetivo e stack tecnológica detalhada.
  * **Arquitetura Atual**: Mapeamento real das camadas e integridade estrutural baseada em fatos, sem suposições.
  * **Restrições**: Provedores obrigatórios de nuvem, resiliência offline, imutabilidade de logs ou limitações técnicas.

---

## 3. Classificação e Controle de Escopo

Toda demanda de modificação do sistema deve ser classificada de forma estrita e ter limites físicos definidos:

### 3.1 Classificação
* **Correção (Bugfix)**: Correção de comportamento anômalo sem alteração de contratos ou novas funcionalidades.
* **Evolução (Feature)**: Acréscimo de novas capacidades ou fluxos de valor de negócio.
* **Refatoração**: Melhoria na legibilidade ou acoplamento de código sem alterar o comportamento externo funcional do sistema.
* **Mudança Arquitetural**: Alteração profunda de fundações (ex: troca de banco de dados, migração de gerenciador de estado).

### 3.2 Escopo Estrito
* **Dentro do Escopo**: Lista dos arquivos, módulos e funções que serão de fato alterados.
* **Fora do Escopo**: Delimitação clara das áreas vizinhas que não devem ser tocadas.
* *Regra*: É proibido ampliar o escopo da tarefa em runtime sem aprovação formal do arquiteto.

---

## 4. Análise de Risco e Tomada de Decisão (ADR)

* **Avaliação de Risco**: Use a **[Matriz de Risco Arquitetural](../modelos/matriz-risco.md)** do EOS para classificar os riscos de implantação da tarefa.
* **Gatilho de ADR**: Toda alteração classificada como *Mudança Arquitetural* ou que gere riscos de nível **Crítico (Score >= 6)** exige obrigatoriamente a escrita e aprovação de um **ADR** antes do código.

---

## 5. Execução Incremental (Baby Steps)

Toda implementação deve seguir a metodologia de baby steps:
1. Escreva pequenos incrementos localizados em um único módulo.
2. Execute validações estáticas locais (`tsc --noEmit`, linters) e testes locais.
3. Certifique-se de que o comportamento anterior esperado foi totalmente preservado antes de avançar para a próxima alteração física.
4. É estritamente proibido refatorar múltiplos domínios de negócio em paralelo.

---

## 6. Validação Final e Registro de Aprendizado

### 6.1 Validação Multidimensional
O fechamento da tarefa exige o checklist completo:
* **Funcional**: O sistema funciona exatamente como esperado sob todas as condições operacionais?
* **Arquitetural**: A alteração respeita os limites de acoplamento e coesão das camadas?
* **Segurança e Desempenho**: Foram introduzidas falhas de vazamento de dados, injeções ou gargalos de processamento?

### 6.2 Registro de Aprendizado
Ao concluir a tarefa, caso tenham sido tomadas decisões importantes de design ou descobertos comportamentos ocultos do legado, grave um arquivo sob o diretório do projeto consumidor:
* **Caminho**: `.eos/aprendizados/[AAAA-MM-DD]-[nome-da-tarefa].md`
* **Campos Obrigatórios**: O problema, a solução final adotada, trade-offs encontrados e o conhecimento que pode ser reaproveitado pelo time no futuro.
