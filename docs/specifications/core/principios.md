# Princípios Fundamentais de Engenharia — EOS

Este documento estabelece as leis fundamentais que regem todas as decisões de engenharia sob o **Engineering Operating System (EOS)**. Todo desenvolvedor, arquiteto ou agente operando sob este framework deve seguir estes princípios de forma irrestrita.

---

## 1. Entender Antes de Modificar

A pressa para codificar é o principal gerador de complexidade acidental e bugs em sistemas complexos. Nenhuma alteração de código ou arquitetura deve ser iniciada sem antes mapear e compreender o ecossistema afetado.

### Fluxo Operacional Obrigatório
```
Analisar ────> Compreender ────> Planejar ────> Executar ────> Validar
```

1. **Analisar**: Ler o código existente, identificar os pontos de entrada e saída, examinar dependências e logs.
2. **Compreender**: Mapear as intenções originais do design, as regras de negócio implícitas e o fluxo de dados envolvido.
3. **Planejar**: Escrever uma estratégia de implementação (incluindo testes e estratégia de rollback) antes de tocar no código de produção.
4. **Executar**: Realizar as alterações de forma cirúrgica, respeitando o padrão estético e estrutural preexistente.
5. **Validar**: Testar a alteração localmente, verificar regressões, executar testes unitários/integração e observar métricas se aplicável.

> [!IMPORTANT]
> Se você não consegue explicar como o código atual funciona e por que ele foi escrito daquela forma, você não tem autorização para alterá-lo.

---

## 2. Resolver a Causa Raiz

Soluções temporárias ("gambiarras" ou "quick fixes") tratam sintomas, não causas. Elas reduzem o atrito imediato ao custo de aumentar exponencialmente a dívida técnica futura.

### O Modelo Cascata de Resolução
```
Sintoma (O que quebrou)
   │
   ▼
Causa Raiz (Por que quebrou no nível mais profundo)
   │
   ▼
Solução Estrutural (Como evitar que isso ou coisas semelhantes quebrem novamente)
```

### Diretrizes de Ação:
* **Evite o Patching Reativo**: Não adicione condicionais `if` extras apenas para desviar de um valor `undefined` ou `null` sem entender a origem desse estado inconsistente.
* **Refatore na Origem**: Se uma API retorna dados incorretos, corrija o contrato ou o persistência da API, não trate o erro formatando os dados no frontend.
* **Automação de Salvaguardas**: Sempre que corrigir uma causa raiz, escreva um teste de regressão automático para garantir que a falha não retorne.

---

## 3. Baixo Acoplamento e Alta Coesão

Estes dois pilares garantem que o software permaneça modificável ao longo do tempo.

### Baixo Acoplamento (Independência entre Módulos)
Os módulos devem se comunicar através de interfaces bem definidas e contratos estritos, ocultando seus detalhes de implementação interna.
* **Princípio do Menor Conhecimento**: Um componente ou classe não deve conhecer a estrutura interna dos dados que processa além do necessário.
* **Substituibilidade**: Deve ser possível trocar a implementação de um serviço (ex: migrar de Firebase para Postgres) sem precisar reescrever a lógica de interface ou regras de negócio centrais.

### Alta Coesão (Foco Único de Responsabilidade)
Cada classe, módulo, função ou componente deve fazer apenas uma coisa e fazê-la de forma excelente.
* **Divisão de Responsabilidades**: Lógica de renderização (UI), lógica de estado (Store/State) e lógica de acesso a dados (Services/API) devem viver em camadas separadas.
* **Tamanho e Legibilidade**: Funções gigantescas que realizam múltiplas tarefas devem ser decompostas em subfunções puras e testáveis.

---

## 4. Decisões Baseadas em Contexto (Sem Dogmatismo)

Não existem soluções perfeitas ou ferramentas universais em engenharia de software; existem apenas *trade-offs* (escolhas com perdas e ganhos associados).

### Análise de Trade-offs
Toda proposta técnica deve ser avaliada contra o contexto atual do projeto, respondendo a:
1. **Problema**: Qual o gargalo real de hoje? (Desempenho, manutenibilidade, velocidade de entrega?)
2. **Alternativas**: Quais as 2 ou 3 abordagens possíveis?
3. **Custos**: Qual o custo de aprendizado, desenvolvimento e manutenção a longo prazo?
4. **Benefícios**: Qual o ganho real de valor para o negócio ou estabilidade do produto?
5. **Riscos**: O que pode dar errado se adotarmos essa tecnologia?

> [!TIP]
> Nunca adote uma biblioteca ou arquitetura simplesmente porque é "tendência do mercado". Escolha soluções cujo conjunto de limitações seja aceitável para o seu contexto de negócio.

---

## 5. Consciência do Contexto Arquitetural (Diferenciação de Acoplamento)

O EOS deve ser capaz de avaliar qualquer software sem impor dogmas arquiteturais alheios ao ecossistema do projeto.

### Diretriz de Distinção:
1. **Acoplamento Inerente ao Framework**: Limitações impostas pelo design-pattern nativo da plataforma adotada (ex: o uso de Active Record no Laravel/Rails, ou o App Router no Next.js). Estas decisões de infraestrutura inicial não devem ser penalizadas, desde que sigam as boas práticas da plataforma.
2. **Acoplamento Acidental do Projeto**: Decisões específicas tomadas pelo time de desenvolvimento que introduzem complexidade desnecessária ou vazamento de responsabilidade (ex: escrever queries SQL complexas (`DB::raw`) diretamente na Action do Controller, ou importar stores de UI dentro de um módulo de utilitários puros). Apenas estes desvios acidentais devem sofrer penalizações nas métricas de arquitetura.

