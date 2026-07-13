# [ADR-XXXX] — [Título da Decisão Arquitetural]

* **Status**: [Proposta | Aprovada | Rejeitada | Substituída por ADR-YYYY]
* **Autor(es)**: [Nome/Perfil do Autor]
* **Data**: [AAAA-MM-DD]
* **Decisões Relacionadas**: [Se aplicável, link para ADR-ZZZZ]

---

## 1. Contexto e Problema

*Descreva o contexto no qual esta decisão se insere e o problema que estamos tentando resolver. Quais são as necessidades de negócio, as restrições técnicas (tempo, custo, conhecimento) e as limitações do estado atual do sistema? Apresente fatos e métricas se houver.*

Exemplo:
> "O sistema hoje importa o SDK do Firebase diretamente nos componentes de tela da UI. Isso impede a execução de testes unitários rápidos sem mockar toda a biblioteca do Firebase, além de acoplar nossa interface a um provedor específico de persistência."

---

## 2. Alternativas Consideradas

*Registre e avalie as abordagens possíveis antes da tomada de decisão. Isso garante que a equipe entenda o espaço de design e os caminhos que foram rejeitados.*

| Alternativa | Prós | Contras | Por que foi descartada? |
| :--- | :--- | :--- | :--- |
| **Opção A: [Descrição]** | Rápido de programar; zero curva de aprendizado inicial. | Mantém o acoplamento intocado; dificulta manutenção. | Não resolve os riscos de portabilidade a longo prazo. |
| **Opção B: [Descrição]** | Desacoplamento absoluto via arquitetura Clean. | Boilerplate excessivo para o tamanho atual do projeto. | Traria complexidade acidental desproporcional ao time. |

---

## 3. Decisão Proposta

*Descreva a solução técnica escolhida. O que estamos adotando, removendo ou alterando na arquitetura? Seja direto, inequívoco e pragmático.*

Exemplo:
> "Decidimos isolar todos os acessos ao Firebase em uma camada de `Services` específica, acessada através de instâncias de serviço puras e tipadas no TypeScript. Os componentes de UI e as stores de estado global não farão chamadas diretas ao SDK do Firebase."

---

## 4. Consequências e Trade-offs

*Toda decisão arquitetural tem custos e benefícios. Pense em segunda ordem (Second-Order Thinking).*

### Ganhos (Benefícios de 1ª e 2ª Ordem)
* **[Benefício 1]**: Ex: Isolamento total do provedor de banco de dados, facilitando migrações futuras.
* **[Benefício 2]**: Ex: Possibilidade de mockar a camada de Service em testes de unidade.

### Custos / Riscos (Perdas de 1ª e 2ª Ordem)
* **[Custo 1]**: Ex: Introdução de mais arquivos de boilerplate (`services/authService.ts`, etc.) para encapsular as chamadas básicas.
* **[Custo 2]**: Ex: Curva de aprendizado inicial da equipe para parar de importar o Firebase diretamente na UI.

---

## 5. Notas de Implementação (Opcional)

*Padrões de design, exemplos de código rápidos ou diretrizes que guiarão a equipe durante o desenvolvimento físico da decisão.*
