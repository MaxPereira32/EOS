# Matriz de Acoplamento e Coesão — EOS

A **Matriz de Acoplamento e Coesão** do EOS é uma ferramenta analítica para avaliar o grau de interdependência entre os componentes de um sistema (acoplamento) e a especialização de suas responsabilidades individuais (coesão).

---

## 1. Conceitos Fundamentais

* **Acoplamento**: Mede o nível de dependência que um módulo tem de outro ou de bibliotecas externas. Deve ser **o mais baixo possível**.
* **Coesão**: Mede quão focada e unificada é a responsabilidade de um único módulo ou classe. Deve ser **o mais alta possível**.

---

## 2. A Matriz de Diagnóstico

Use a tabela abaixo para classificar cada componente ou arquivo crítico do sistema em relação ao acoplamento e à coesão.

| Nível de Acoplamento | Nível de Coesão | Classificação Arquitetural | Ação Recomendada |
| :--- | :--- | :--- | :--- |
| **Alto** (depende de infraestrutura, libs ou outros arquivos diretamente) | **Baixa** (faz muitas coisas diferentes ao mesmo tempo) | **Zona do Caos (Crítico)** | Refatoração urgente. Dividir em partes menores e encapsular dependências de infraestrutura em classes/interfaces isoladas. |
| **Alto** (depende de infraestrutura externa) | **Alta** (focado em uma única responsabilidade de negócio) | **Acoplamento de Infraestrutura** | Isolar a chamada externa em uma camada de `Service` ou `Adapter` para manter a lógica de negócio pura. |
| **Baixo** (independente, interage via contratos) | **Baixa** (função/classe gigante que resolve múltiplos problemas) | **Monólito Incoeso** | Quebrar em subfunções puras e reutilizáveis, separando orquestração de lógica de execução. |
| **Baixo** (independente e testável por mock) | **Alta** (faz apenas uma coisa de forma excelente) | **Padrão Ouro (Ideal)** | Manter e documentar como referência de design de código para a equipe. |

---

## 3. Como Medir o Acoplamento na Prática

Avalie a presença dos seguintes indicadores (code smells) no código analisado:

### Indicadores de Alto Acoplamento:
1. **Importações Diretas de SDKs/Frameworks de Terceiros na UI**:
   * *Exemplo*: Importar `firestore` ou `auth` do Firebase dentro de um componente React/Vue/Svelte.
2. **Dependência Bidirecional**:
   * *Exemplo*: Módulo A importa Módulo B, e Módulo B importa Módulo A (acoplamento circular).
3. **Dependência de Estrutura Interna (Invasão de Privacidade)**:
   * *Exemplo*: Componente visual acessa e altera propriedades profundas de um objeto de estado sem utilizar métodos/funções acessoras dedicadas.

### Indicadores de Baixa Coesão:
1. **Mistura de Responsabilidades (UI + Negócio + Persistência)**:
   * *Exemplo*: Um componente de botão de compras calcula o imposto de importação, faz um `fetch` para a API de pagamento e renderiza o layout neumórfico de uma só vez.
2. **Componentes/Arquivos Gigantes**:
   * *Exemplo*: Arquivos com mais de 500 linhas de código costumam indicar que múltiplas responsabilidades foram misturadas no mesmo escopo.

---

## 4. Métodos de Resolução (Como Desacoplar)

1. **Camada de Adaptação / Abstração (Services)**:
   * Em vez de consumir `db.collection('produtos').add()`, utilize um `ProdutoService.adicionar(produto)`. Se o banco de dados mudar, a UI não sofre impactos.
2. **Injeção ou Inversão de Dependências (DIP)**:
   * Os componentes devem depender de abstrações (interfaces/contratos), e não de implementações concretas de baixo nível.
3. **Funções Puras**:
   * Isole lógicas de cálculo ou formatação de dados em funções utilitárias puras que não leem nem modificam variáveis externas (sem efeitos colaterais), tornando-as 100% testáveis.
