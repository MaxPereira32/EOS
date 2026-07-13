# Base de Conhecimento de Padrões e Frameworks — APE

Este catálogo contém a base de consulta técnica do **Architectural Profile Engine (APE)** sobre as restrições inerentes, trade-offs e soluções de design para os principais frameworks.

---

## 1. Padrão Active Record (Laravel, Rails, Django)
* **Conceito**: A entidade de dados possui representação direta na tabela de banco física e herda métodos de persistência do ORM (`save()`, `delete()`, `find()`).
* **Acoplamento**: Físico e inerente à persistência.
* **Boa Prática**: Manter controllers enxutos. Consultas simples (leitura direta) podem ocorrer nos controladores. Consultas complexas (joins, agregações, SQL cru) devem ir para classes de serviço de consulta (**Query Services**).
* **Trade-off**: Velocidade de desenvolvimento e simplicidade extrema, ao custo de dependência de banco de dados nos modelos de domínio.

---

## 2. Padrão Repository (Spring, NestJS, Clean Architecture)
* **Conceito**: Camada mediadora entre o domínio e a infraestrutura de acesso a dados que simula uma coleção de objetos em memória.
* **Acoplamento**: Desacoplado via interfaces (ports).
* **Boa Prática**: Usar quando há múltiplos repositórios ou necessidade real de substituir a base física (ex: de banco de dados SQL para NoSQL ou serviços externos).
* **Trade-off**: Alto desacoplamento e testabilidade por mocks pura, ao custo de alta complexidade acidental e excesso de arquivos vazios (boilerplate).

---

## 3. Estado Client-Side SPA (Zustand, Redux, Pinia)
* **Conceito**: Armazenamento de estado volátil em memória no navegador do cliente para gerenciar reatividade e fluxos visuais.
* **Acoplamento**: Componentes visuais reagem ao estado global da store.
* **Boa Prática**: Separar a lógica assíncrona de chamadas de API externas em wrappers de **Serviços** (`src/nucleo/servicos/`). Os hooks de store devem se registrar e consumir estes serviços em vez de disparar chamadas HTTP diretamente em suas actions.
* **Trade-off**: Facilidade de gerenciar estados e fluxos globais complexos, ao custo de maior consumo de memória RAM do cliente e necessidade de sincronização manual com o servidor.
