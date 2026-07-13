# Prompts Operacionais de Engenharia — EOS

Esta pasta contém os **Prompts Operacionais de Engenharia** do EOS. Esta camada foi introduzida na versão `v0.1.4` para viabilizar a ponte entre a teoria arquitetural e a execução prática de tarefas por desenvolvedores e agentes autônomos de Inteligência Artificial.

---

## 1. Diferença entre Protocolo e Prompt

Para manter a separação estrita de responsabilidades definida pelo EOS:

* **Protocolos (`protocolos/`)**: Definem **o processo**. Respondem a *o quê* deve ser feito, quais são as fases lógicas, as salvaguardas e os critérios regulatórios de governança do repositório.
* **Prompts Operacionais (`prompts/`)**: Orientam **a execução**. Funcionam como instruções executáveis passo a passo para direcionar o comportamento de agentes cognitivos (humanos ou IAs) em contextos de tarefas específicas em tempo de execução.

```
┌─────────────────────────────────┐
│     Protocolo (O Processo)      │
│  "Analise o projeto e identifique│
│   riscos estruturais..."        │
└────────────────┬────────────────┘
                 │ (Fornece as regras)
                 ▼
┌─────────────────────────────────┐
│      Prompt (A Execução)        │
│  "Instruções passo a passo:     │
│   1. Mapeie pastas...           │
│   2. Gere tabela de risco..."   │
└─────────────────────────────────┘
```

---

## 2. Catálogo de Prompts e Quando Usar

| Prompt | Contexto de Uso | Entrada Esperada | Saída Gerada |
| :--- | :--- | :--- | :--- |
| **[onboarding-projeto.md](onboarding-projeto.md)** | Ao iniciar o trabalho em um repositório novo ou após grandes reestruturações de ramificação. | Base de código desconhecida. | Mapa estrutural, fluxo de dados e diagnóstico estático de riscos. |
| **[auditoria-arquitetural.md](auditoria-arquitetural.md)** | Diagnóstico cíclico de saúde ou preparação para migrações complexas. | Camada de código e mapa de dependências. | Relatório Executivo de Auditoria Permanente (EPAA) e Checklist Operacional preenchido. |
| **[implementacao-controlada.md](implementacao-controlada.md)** | Execução de novas features, correções de bugs ou refatorações de código. | Especificação e arquivos alvos. | Implementação incremental em baby steps protegida por salvaguardas. |
| **[revisao-pos-implementacao.md](revisao-pos-implementacao.md)** | Pós-implementação e antes do merge do Pull Request. | Diff de código e arquivos modificados. | Análise de coesão, acoplamento e confirmação de comportamento intacto. |

---

## 3. Fluxo Operacional Recomendado

Durante o ciclo de vida do desenvolvimento de uma feature ou refatoração, o fluxo recomendado de acionamento de prompts é:

```
[ Entrada no Projeto ] ──► [Onboarding]
                                │
                                ▼
                       [Auditoria Arquitetural]
                                │
                                ▼
                       [Implementação Controlada]
                                │
                                ▼
                       [Revisão Pós-Implementação]
```
