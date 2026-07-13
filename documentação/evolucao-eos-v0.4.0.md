# Relatório de Evolução Arquitetural — EOS v0.4.0 (Domain-Driven Architecture)

Este relatório detalha a transição do EOS de uma infraestrutura baseada em scripts e arquivos para uma plataforma de **Continuous Architecture baseada em Modelo de Domínio (Domain Model Specification)**.

---

## 1. Evolução do Modelo Conceitual (RFC-002)

O EOS agora possui um **Domain Model formal** que define a linguagem ubíqua e os limites de contexto da plataforma.

### Entidades do Domínio:

1. **Fact** (`core/domain/fact.js`): Dado bruto, atômico e imutável coletado de ferramentas externas. Possui campos obrigatórios e tipados (`metric`, `value`, `source`, `timestamp`).
2. **Metric** (`core/domain/metric.js`): Medida calculada a partir de fatos canônicos. Desacopla fatos brutos de avaliações de qualidade.
3. **Indicator** (`core/domain/indicator.js`): Dimensão de qualidade estrutural do EOS (ARQ, GOV, TST, etc.). Inicia com pontuação máxima de 100, e aplica penalidades subtrativas a partir de regras ativadas.
4. **RuleResult** (`core/domain/rule-result.js`): Rastreamento de atração e impacto de regras, permitindo mapeamento de impacto N:N (uma regra afetando vários indicadores simultaneamente).
5. **ExecutionContext** (`core/platform/execution-context.js`): Identidade imutável de execução que resolve automaticamente branch, commit hash, timestamp e ambiente.

---

## 2. Reestruturação do Código (Separação de Camadas)

O diretório do core foi fisicamente reestruturado para desacoplar as responsabilidades:

```
core/
├── platform/           # Identidade e barramento (eos-platform.js, event-bus.js, execution-context.js)
├── domain/             # Contratos rígidos (fact.js, metric.js, indicator.js, rule-result.js)
├── engines/            # Processamento de lógica (normalizer.js, metrics-engine.js, rule-engine.js, quality-gate-engine.js)
├── reporters/          # Emissão de relatórios (json-reporter.js, markdown-reporter.js)
├── collectors/         # Plugins adaptadores
└── rules/              # Regras declarativas declaradas em JSON
```

---

## 3. Segurança em Regras Declarativas e Eventos

* **Sem Eval de Strings**: Eliminamos a execução dinâmica de fórmulas matemáticas baseadas em strings (`min(errorDensity * 5, 50)`). Agora, o motor avalia penalidades seguras de tipo `linear` (baseado em fator e limite) ou `fixed`.
* **Event Bus Tipado**: O barramento valida se os eventos pertencem a um catálogo registrado e garante que todas as mensagens possuam um `ExecutionContext` anexado.

---

## 4. Validação e Homologação (Cebus ERP)

* **Execução**: `node ../Engineering-Operating-System/EOS/core/platform/eos-platform.js`
* **Metadados Rastreáveis**: Capturou a branch `main` e commit `bb2ccbb` no `ExecutionContext`.
* **Fatos & Métricas**: Coletados erros e warnings de linting, número de testes unitários executados (5 testes) e violações arquiteturais (0).
* **Consistência de Arquivos**: O `json-reporter` agora lê o `auditoria.json` antes de reescrevê-lo, preservando a seção de configurações `"evidencias"` para execuções futuras.
