# Matriz de Risco Arquitetural — EOS

A **Matriz de Risco Arquitetural** é uma ferramenta analítica de diagnóstico utilizada nos protocolos de análise do EOS para classificar e priorizar os riscos associados a decisões técnicas, acoplamento de código e débitos técnicos em um sistema.

---

## 1. Critérios de Classificação

O nível de risco arquitetural é calculado a partir de duas variáveis: **Impacto** e **Probabilidade de Falha/Mudança**.

### 1.1 Impacto Arquitetural
Mede a extensão do dano ou o custo de retrabalho se a falha ocorrer ou se uma mudança for necessária.
* **Alto (3)**: Afeta múltiplos módulos, interrompe fluxos críticos de negócio, exige refatorações profundas de banco de dados/infraestrutura ou viola princípios de segurança.
* **Médio (2)**: Afeta um módulo isolado, exige refatorações pontuais em componentes sem quebrar contratos de dados.
* **Baixo (1)**: Correção puramente estética ou de legibilidade de código, isolada a uma função pura ou componente simples.

### 1.2 Probabilidade de Ocorrência / Mudança
Mede a chance do componente falhar em produção ou de o sistema exigir alteração desse trecho devido a necessidades de negócio ou infraestrutura.
* **Alta (3)**: Componente instável, sem cobertura de testes, alterado constantemente em novas features, ou dependente de tecnologia que está sob planejamento de migração.
* **Média (2)**: Componente maduro, mas que possui dependências acopladas a bibliotecas externas sujeitas a quebras de versão.
* **Baixa (1)**: Código estável, isolado de bibliotecas de terceiros, coeso e coberto por testes unitários.

---

## 2. A Matriz de Pontuação

Multiplique os valores de **Impacto (1 a 3)** e **Probabilidade (1 a 3)** para obter o Score de Risco final (de 1 a 9):

$$\text{Score de Risco} = \text{Impacto} \times \text{Probabilidade}$$

| Score | Classificação | Prioridade Técnica de Ação |
| :---: | :--- | :--- |
| **7 a 9** | 🔴 **Crítico** | Exige criação imediata de **ADR** e inclusão com alta prioridade no **Roadmap Técnico**. Deve ser mitigado antes de novas features. |
| **4 a 6** | 🟡 **Moderado** | Deve ser planejado no **Roadmap Técnico** de médio prazo. Ações de refatoração devem ser casadas com novas entregas. |
| **1 a 3** | 🟢 **Baixo** | Débito técnico tolerável. Deve ser resolvido de forma orgânica pela equipe aplicando a **Regra do Escoteiro** no dia a dia. |

---

## 3. Exemplo Prático de Aplicação

| Risco Arquitetural Detectado | Impacto | Probabilidade | Score | Classificação | Ação EOS |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Firebase importado diretamente nas stores Zustand** (Migração MySQL planejada) | 3 (Alto) | 3 (Alta) | **9** | 🔴 Crítico | Executar imediatamente protocolo de desacoplamento. |
| **Instabilidade de biblioteca externa de gráficos** | 2 (Médio) | 2 (Média) | **4** | 🟡 Moderado | Isolar a biblioteca em um wrapper local. |
| **Nomenclatura inconsistente em helper puro** | 1 (Baixo) | 1 (Baixa) | **1** | 🟢 Baixo | Ajustar de forma oportuna durante manutenções comuns. |
