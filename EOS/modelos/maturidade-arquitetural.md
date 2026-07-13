# Modelo de Maturidade Arquitetural — EOS

O **Modelo de Maturidade Arquitetural** do EOS é uma ferramenta diagnóstica para avaliar a qualidade técnica, o design de software e as práticas de evolução de um repositório, permitindo medir e guiar seu aprimoramento ao longo do tempo.

---

## Níveis de Maturidade

```
[ Nível 1: Estrutura Desconhecida ]
               │
               ▼
[ Nível 2: Documentação Inicial ]
               │
               ▼
[ Nível 3: Arquitetura Controlada ]
               │
               ▼
[ Nível 4: Engenharia Evolutiva ]
```

---

## Detalhamento dos Níveis

### Nível 1: Estrutura Desconhecida
* **Características**:
  * Ausência de documentação de arquitetura atualizada ou padronizada.
  * Regras de negócio, lógica de interface e conexões com provedores de infraestrutura misturadas nos mesmos escopos/arquivos.
  * Alto acoplamento técnico: SDKs ou bibliotecas de terceiros consumidos diretamente pelas telas de UI sem abstração.
  * Falta de testes automatizados ou testes instáveis.
* **Diagnóstico**: O sistema evolui de forma reativa; novas funcionalidades ou alterações trazem alto risco de regressões silenciosas.

### Nível 2: Documentação Inicial
* **Características**:
  * Presença da pasta `.eos/` na raiz do projeto contendo o contexto mapeado (`contexto-projeto.md`) e a arquitetura documentada (`arquitetura-atual.md`).
  * Mapeamento completo dos limites lógicos do sistema e fluxo de dependências (`mapa-modulos.md`).
  * Conhecimento e mapeamento de riscos e pontos frágeis do sistema em relatórios formais de auditoria.
* **Diagnóstico**: O time compreende o estado real do sistema, mas as melhorias arquiteturais e refatorações de desacoplamento ainda não foram implementadas.

### Nível 3: Arquitetura Controlada
* **Características**:
  * Decisões arquiteturais relevantes registradas formalmente via ADRs (`decisoes/`).
  * Separação estrita de responsabilidades: lógicas de UI (apresentação), Stores (estado) e Services (infraestrutura/APIs) vivem em camadas isoladas.
  * Presença de testes de unidade e integração estáveis e confiáveis validando as regras de negócio cruciais e fluxos principais.
  * Validação robusta de contratos de dados (esquemas de entrada e saída) nas fronteiras do sistema.
* **Diagnóstico**: O código é manutenível, testável e previsível. Alterações estruturais podem ser efetuadas com confiança técnica.

### Nível 4: Engenharia Evolutiva
* **Características**:
  * Automação de salvaguardas e conformidade na esteira de CI/CD (linting, testes automáticos e análise estática rigorosa).
  * Métricas de saúde do código monitoradas e rastreadas (tempo de build, cobertura de testes, acoplamento).
  * Observabilidade ativa em produção (health checks, logging estruturado de erros e monitoramento de desempenho).
  * Processo de evolução contínua guiado por auditorias cíclicas de arquitetura.
* **Diagnóstico**: O sistema está pronto para escala, evolução orgânica segura e migrações estruturais robustas sem perda de velocidade operacional.
