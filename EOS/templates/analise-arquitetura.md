# Análise de Arquitetura — [Nome do Projeto]

Esta análise de arquitetura foi realizada seguindo as diretrizes e protocolos do **Engineering Operating System (EOS)** com o objetivo de mapear a saúde do ecossistema, identificar pontos de falha e planejar a evolução técnica do sistema de forma baseada em evidências.

---

## 1. Manifesto de Execução

Este manifesto define os limites físicos e condições sob as quais esta auditoria foi realizada, garantindo reprodutibilidade e transparência:

* **Projeto Analisado**: [Nome do Projeto / Módulo]
* **Versão do EOS**: EOS v0.1.5
* **Versão do Projeto**: [Branch / Commit Hash / Tag]
* **Data da Execução**: [AAAA-MM-DD]
* **Responsável**: [Identificador do Executor]
* **Escopo Analisado**: [Ex: Diretório src/ e configurações de build]
* **Pastas Incluídas**: [Lista de diretórios inspecionados]
* **Pastas Excluídas**: [Lista de diretórios ignorados]
* **Limitações Encontradas**: [Ex: Ausência de ambiente de testes local ou acesso a logs de homologação]
* **Ferramentas Utilizadas**: [Ex: Grep search, IDE, dependecy-cruiser]
* **Tempo Estimado da Análise**: [Ex: X horas]

---

## 2. Visão Arquitetural Atual

### 2.1 Descrição Lógica
*Como o sistema está organizado em termos de diretórios, módulos e camadas (ex: Feature-based, Clean Architecture, MVC, etc.).*

### 2.2 Diagrama Conceitual de Camadas
*Representação textual ou em formato de bloco de como as camadas do sistema interagem.*
```
[ Camada 1: Entrada / UI ]
          │
          ▼
[ Camada 2: Lógica de Aplicação / Estado ]
          │
          ▼
[ Camada 3: Serviços / Clientes de API ]
          │
          ▼
[ Camada 4: Infraestrutura / Banco de Dados / SDKs ]
```

### 2.3 Fluxo de Dados Crítico
*Descreva o caminho percorrido por uma informação importante, de ponta a ponta, no sistema (ex: Fluxo de Entrada de Lote, Baixa de Insumo).*

---

## 3. Mapeamento de Dependências e Acoplamento

### 3.1 Provedores de Infraestrutura Externos
*SDKs ou APIs de terceiros que estão diretamente importados na aplicação (ex: Firebase, AWS SDK, Stripe, etc.).*
* **Dependência**: [Nome do SDK]
  * **Ponto de Acoplamento**: [Onde é importado no código]
  * **Nível de Risco**: [Baixo / Médio / Alto]

### 3.2 Bibliotecas de Interface e Utilitários
*Bibliotecas que impactam na portabilidade e no tamanho do bundle final.*
* **Dependência**: [Nome da Lib]
  * **Propósito**: [O que resolve]
  * **Grau de Acoplamento**: [Alto / Baixo]

---

## 4. Matriz de Cobertura da Análise

Tabela explícita detalhando quais áreas do sistema foram auditadas nesta execução, mitigando suposições silenciosas:

| Área Inspecionada | Nível de Cobertura | Observação de Limite |
| :--- | :---: | :--- |
| **Arquitetura** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Dependências** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Fluxos** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Estado Global** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Persistência** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Regras de Negócio** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Segurança** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |
| **Performance** | [ ] Coberto / [ ] Parcial / [ ] Não analisado | [Descreva] |

---

## 5. Diagnóstico de Qualidade (Mapeamento de Descobertas)

Mapeamento formal de todos os problemas técnicos catalogados, ordenados por criticidade:

### 🔴 Descobertas Críticas (Score 7-9)
* **ID Descoberta**: ARQ-[Seq]
  * **Título**: [Título Resumido]
  * **Categoria**: [Arquitetura / Código / Processo / Documentação]
  * **Evidência**: [Caminho do arquivo e trecho exato ou linha]
  * **Impacto**: [Consequências para o sistema]
  * **Risco**: [Crítico]
  * **Confiança**: [Alta / Média / Baixa]
  * **Motivo**: [Justificativa técnica da classificação]

### 🟡 Descobertas Moderadas (Score 4-6)
* [Utilize o mesmo formato de ficha acima]

### 🟢 Descobertas Baixas (Score 1-3)
* [Utilize o mesmo formato de ficha acima]

---

## 6. Matriz de Risco

Tabela de Score EOS ($\text{Impacto} \times \text{Probabilidade}$):

| ID Descoberta | Problema | Impacto (1-3) | Probabilidade (1-3) | Score (1-9) | Classificação |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **ARQ-001** | [Resumo do problema] |  |  |  |  |

---

## 7. Recomendações Futuras

Toda recomendação técnica gerada por esta análise deve ser rigorosamente justificada respondendo às perguntas de governança do EOS:

* **ID Recomendação / Ação Proposta**: [Descreva a melhoria]
  * **Qual problema resolve?**: [Justificativa clara]
  * **Qual evidência a motivou?**: [Referencie o ID ARQ-XXX]
  * **Qual princípio do EOS atende?**: [Princípios Core]
  * **Qual risco de não implementá-la?**: [Consequências de inação a longo prazo]
  * **Qual risco de implementá-la?**: [Trade-offs, custos de migração ou riscos de regressão]
  * **Qual esforço estimado?**: [Alto / Médio / Baixo]
  * **Prioridade**: [Crítica / Alta / Média / Baixa]

---

## 8. Conclusões e Decisões Técnicas Associadas

Novas ADRs (Architecture Decision Records) propostas ou geradas a partir desta análise:
* **[ADR-XXXX]**: [Título da ADR] - Referencia [ID Descoberta] - Status: [Proposta]

---

## 9. Status da Auditoria (Critério de Encerramento)

Determinação inequívoca de encerramento do onboarding:

* **Status da Auditoria**:
  * [ ] **Incompleta** (Faltam análises críticas de escopo)
  * [ ] **Completa com ressalvas** (Escopo concluído com limitações de visibilidade)
  * [ ] **Completa** (Todos os itens previstos validados sem restrições)
* **Itens Pendentes**: [Descreva, se houver]
* **Impacto das Pendências**: [Se houver]
* **Próxima Ação Recomendada**: [Se houver]
