# EOS — Catálogo de Antipadrões Arquiteturais

## Versão 1.0

Este catálogo cataloga desvios de design comuns detectados em revisões de código e auditorias. Cada problema encontrado deve ser rotulado com o respectivo ID para fins de padronização, objetividade e facilidade de comparação histórica.

---

## Catálogo de Antipadrões

### 1. AP-001 — Acesso Direto à Infraestrutura
* **Definição**: Camadas superiores do sistema (como componentes visuais de UI ou stores de estado global) importam e acionam diretamente SDKs de banco de dados, clientes HTTP/Axios ou APIs de infraestrutura externa.
* **Por que é ruim**: Acopla o comportamento visual e o controle de estado à infraestrutura física. Dificulta a migração tecnológica de banco de dados e impede a mockagem simples em testes unitários.
* **Solução**: Mover os imports de infraestrutura para arquivos sob `src/nucleo/servicos/` ou adapters isolados, expondo apenas funções abstratas/promessas para as stores e componentes.

---

### 2. AP-002 — Vazamento de Regras de Domínio na UI
* **Definição**: Componentes visuais realizam cálculos de regras de negócio complexas, validações fiscais, processamento lógico de dados de domínio ou manipulações estruturais complexas.
* **Por que é ruim**: Dificulta a reutilização de regras em outros componentes, impede testes automatizados puros de domínio (são exigidos testes pesados de renderização) e gera inconsistências visuais.
* **Solução**: Centralizar regras de validação em schemas (ex: Zod) e lógicas de processamento de negócios em services ou funções utilitárias puras.

---

### 3. AP-003 — Duplicação Crítica de Lógica (Copy-Paste)
* **Definição**: Blocos idênticos de código, consultas de banco de dados redundantes ou lógicas de manipulação repetidas em múltiplos componentes ou arquivos sem encapsulamento comum.
* **Por que é ruim**: Aumenta o custo de manutenção. Se uma regra de negócio mudar, o desenvolvedor precisa encontrar e alterar manualmente todas as ocorrências do código copiado.
* **Solução**: Extrair a lógica comum para uma factory, helper ou service centralizado.

---

### 4. AP-004 — Acoplamento Temporal
* **Definição**: Lógicas de execução que exigem que múltiplos métodos assíncronos sejam acionados em uma ordem estrita em runtime, porém sem que essa ordem seja protegida por transações ou orquestrações seguras.
* **Por que é ruim**: Gera condições de corrida (race conditions) e inconsistências de estado no banco de dados quando requisições paralelas falham ou atrasam.
* **Solução**: Agrupar operações assíncronas interdependentes em uma única transação atômica dentro da camada de serviços.

---

### 5. AP-005 — Abstração Prematura
* **Definição**: Criação de interfaces complexas, classes abstratas genéricas ou wrappers complexos de bibliotecas de terceiros sem um caso de uso imediato ou quando existe apenas um consumidor real estável.
* **Por que é ruim**: Adiciona complexidade acidental e boilerplate excessivo ao projeto, dificultando a leitura rápida e a compreensão do fluxo por desenvolvedores juniores/plenos.
* **Solução**: Aplicar a regra de design "YAGNI" (You Aren't Gonna Need It). Desenvolver de forma simples e direta, e refatorar para abstrações genéricas apenas quando surgir a terceira necessidade idêntica.
