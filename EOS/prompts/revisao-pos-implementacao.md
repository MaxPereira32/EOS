# Prompt Operacional: Revisão Pós-Implementação

Utilize este prompt imediatamente após finalizar uma refatoração ou implementação de código, antes de submeter a branch para revisão final (Pull Request) ou merge na branch principal.

---

## Instruções de Execução para o Agente

Você deve agir como o revisor final da alteração efetuada. Sua função é criticar a implementação sob a ótica dos critérios de engenharia do EOS, garantindo que a base de código do sistema não tenha sofrido regressões de qualidade arquitetural.

---

## Roteiro de Avaliação Técnica

### 1. Crítica Arquitetural
Analise os arquivos modificados e responda:
* **Redução de Acoplamento**: A alteração diminuiu a dependência direta de SDKs externos ou bancos de dados nas camadas de negócio ou UI?
* **Aumento de Coesão**: Os novos componentes ou arquivos criados possuem apenas uma única e clara responsabilidade lógica?
* **Respeito às Camadas**: Há algum desvio arquitetural de imports (ex: componentes visuais importando módulos de infraestrutura diretamente)?

### 2. Análise de Qualidade de Código e Legibilidade
Avalie o código implementado contra as diretrizes abaixo:
* **Legibilidade**: A nomenclatura de variáveis, funções e métodos é clara, autoexplicativa e em conformidade com o glossário do projeto?
* **Facilidade de Manutenção**: O código é simples e direto? A complexidade ciclomática foi reduzida ou mantida sob controle?
* **Testes e Cobertura**: Foram adicionados testes adequados para cobrir os novos fluxos ou garantir que as lógicas refatoradas permaneçam estáveis? Os testes mockam dependências de forma correta?

### 3. Avaliação de Impacto e Dívidas Futuras
Identifique efeitos colaterais de longo prazo:
* **Novos Débitos Técnicos**: A solução adotada introduziu alguma gambiarra ou solução temporária que precisará ser revisada?
* **Novos Riscos**: A alteração aumentou a chance de falha sob condições específicas (ex: operação offline, concorrência de dados)?
* **Capacidade de Evolução**: O sistema está mais preparado para mudanças futuras do que estava antes da implementação?

---

## Formato do Relatório de Validação de PR

Ao final da revisão, anexe o seguinte sumário no corpo do Pull Request ou no diário de auditorias locais do projeto:

```markdown
# Validação de Engenharia Pós-Implementação

## 1. Avaliação Arquitetural
* **Acoplamento**: [Melhorado / Mantido / Piorado - Justifique]
* **Coesão**: [Melhorado / Mantido / Piorado - Justifique]
* **Contratos de Camada**: [Conforme / Inconforme - Justifique]

## 2. Indicadores de Código
* **Legibilidade**: [Excelente / Boa / Precisa de Melhorias]
* **Cobertura de Testes**: [Coberto / Parcial / Sem Testes]
* **Complexidade**: [Reduzida / Mantida / Aumentada]

## 3. Saldo de Dívida Técnica
* *A alteração resolveu o problema proposto sem abrir novos riscos estruturais?* [Sim / Não - Se não, liste as mitigações planejadas]
```
