# Pensamento Sênior e Governança Técnica — EOS

Este documento descreve os modelos mentais e a postura profissional exigida de engenheiros e arquitetos operando no ecossistema do **Engineering Operating System (EOS)**. A senioridade em engenharia não é medida por anos de experiência, mas pela maturidade das decisões tomadas e seu impacto a longo prazo.

---

## 1. Complexidade Essencial vs. Complexidade Acidental

Um dos maiores desafios no desenvolvimento de software é a gestão da complexidade.

* **Complexidade Essencial**: É inerente ao domínio do problema de negócio. Se o negócio possui regras fiscais complexas, o software inevitavelmente terá de lidar com essa lógica complexa. Não pode ser removida sem alterar o escopo do negócio.
* **Complexidade Acidental**: É introduzida por engenheiros devido a escolhas de design ruins, adoção precoce de frameworks, abstrações prematuras ou falta de padronização. Ela pode e deve ser totalmente evitada.

### A Abordagem do Engenheiro Sênior:
1. **Evite a Abstração Prematura**: Não tente prever o futuro. Escreva código simples, direto e legível. Abstraia apenas quando houver duplicação real e comprovada (Regra de Três).
2. **Delete Código**: O código mais seguro, rápido e fácil de manter é aquele que não existe. Remova ativamente código morto, comentários obsoletos e dependências não utilizadas.
3. **Mantenha a Simplicidade Estética**: Um design elegante é aquele que parece óbvio depois de implementado. Se a sua solução exige explicações excessivamente complexas para ser compreendida por outro par, ela precisa ser simplificada.

---

## 2. Pensamento de Segundo Ordem (Second-Order Thinking)

Engenheiros juniores pensam nas consequências imediatas das suas ações (Pensamento de Primeira Ordem). Engenheiros seniores avaliam as consequências das consequências ao longo do tempo (Pensamento de Segunda Ordem).

### Tabela de Comparação de Modelos Mentais

| Decisão | Consequência de 1ª Ordem (Imediata) | Consequência de 2ª Ordem (Futuro / Impacto) |
| :--- | :--- | :--- |
| **Adicionar biblioteca externa para resolver problema simples** | Resolve o problema em 5 minutos sem escrever código. | Aumenta o tamanho do bundle, cria risco de segurança por dependências aninhadas, cria acoplamento técnico e dificulta atualizações futuras da stack. |
| **Criar uma "gambiarra" rápida para corrigir bug em produção** | O bug é resolvido imediatamente e a aplicação volta a funcionar. | A causa raiz continua ativa, gerando inconsistência silenciosa de dados, e o remendo confunde outros desenvolvedores que tentarão refatorar o trecho no futuro. |
| **Isolar dependências do Firebase em uma camada de Service** | Leva mais tempo para estruturar as chamadas iniciais. | Permite migrar o banco de dados facilmente, facilita a criação de mocks para testes unitários rápidos e isola falhas do SDK externo. |

---

## 3. Governança Técnica e Propriedade Coletiva

O código não pertence a quem o escreveu; pertence ao projeto e à organização. A governança técnica garante a consistência do código mesmo quando desenvolvido por múltiplos profissionais.

### Regra do Escoteiro (Boy Scout Rule)
Sempre deixe a área de código por onde você passou mais limpa do que quando a encontrou.
* Se encontrou um comentário inútil, delete-o.
* Se viu uma variável com nome confuso, renomeie-a.
* Se notou falta de cobertura de testes em uma função simples que está alterando, adicione o teste.

### Egoless Programming (Programação Sem Ego)
* Aceite críticas construtivas no Code Review como oportunidades para melhorar o design do sistema, não como ataques pessoais.
* Entenda que o objetivo das revisões e dos linters não é limitar a criatividade do desenvolvedor, mas manter o estilo homogêneo do projeto, facilitando a leitura de todos.
* Priorize a consistência do padrão de projeto adotado (mesmo que discorde dele) em detrimento do seu estilo de escrita preferido.
