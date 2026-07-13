# Relatório de Evolução Arquitetural — EOS v0.3.0

Este relatório documenta a transição do EOS de um pipeline de scripts para uma **plataforma de Continuous Architecture** com 7 módulos independentes comunicando-se via Event Bus.

---

## 1. Mudança de Natureza

A v0.3.0 não é uma evolução incremental. Ela reorganiza o núcleo do EOS em uma arquitetura de camadas com contratos explícitos:

| Módulo | Responsabilidade Única |
|---|---|
| **Collectors** (`core/collectors/`) | Obter fatos brutos das ferramentas |
| **Normalizer** (`core/normalizer.js`) | Converter formatos heterogêneos em modelo canônico |
| **Metrics Engine** (`core/metrics-engine.js`) | Calcular métricas derivadas (densidades, taxas) |
| **Rule Engine** (`core/rule-engine.js`) | Aplicar regras declarativas de `rules/default-rules.json` |
| **Quality Gate Engine** (`core/quality-gate-engine.js`) | Decidir aprovação/reprovação por limiares |
| **Reporter** (`core/reporter.js`) | Gerar artefatos de saída (JSON + Markdown) |
| **Event Bus** (`core/event-bus.js`) | Desacoplar comunicação entre módulos |

---

## 2. Decisões Arquiteturais

1. **Regras declarativas**: O Rule Engine não contém `if/else` de negócio. Ele interpreta um arquivo JSON externo (`default-rules.json`), permitindo alterar políticas de pontuação sem modificar código.

2. **Separação Fatos → Métricas → Indicadores**: Dados brutos (ex: `eslint.errors = 6`) são normalizados em fatos canônicos, transformados em métricas derivadas (ex: `errorDensity = 6`) e só então avaliados pelo motor de regras para gerar indicadores (ex: `CON = 60`).

3. **Event Bus síncrono**: Optamos por um barramento em memória sem dependências externas. Os eventos (`facts:collected`, `metrics:calculated`, `gate:failed`, etc.) desacoplam completamente os módulos entre si.

4. **Reporter dual**: O módulo gera simultaneamente `auditoria.json` (fonte de verdade para máquinas) e `auditoria-automatica.md` (visualização para humanos).

---

## 3. Resultados de Execução (Cebus ERP)

Pipeline executado com o comando único: `node eos-platform.js`

* **3 plugins de coleta** executados: depcruise, eslint, vitest.
* **2 regras declarativas** ativadas:
  * `RULE-CON-001`: 6 erros de linting → -30 pontos em CON.
  * `RULE-CON-002`: 162 warnings (> 100) → -10 pontos em CON.
* **Quality Gate**: Reprovado (`CON = 60 < mín. 90`).
* **5 eventos registrados** no barramento (log de auditoria temporal).
* **2 artefatos gerados**: `auditoria.json` (175 linhas) + `auditoria-automatica.md`.
