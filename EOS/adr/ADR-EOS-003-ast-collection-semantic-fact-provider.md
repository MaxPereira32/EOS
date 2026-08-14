# ADR-EOS-003 — AST Collector TypeScript e Semantic Fact Provider (MODULE_DEPENDENCY)

* **Status**: Aprovada
* **Autor(es)**: Principal Architect & Senior Core Engineer EOS
* **Data**: 2026-08-14
* **Decisões Relacionadas**: ADR-EOS-001, ADR-EOS-002

---

## 1. Contexto Técnico e Motivação

O Engineering Operating System (EOS) necessita evoluir da análise puramente estrutural do sistema de arquivos (Vertical Slice 1.0) para a análise semântica do código-fonte TypeScript.

O desafio central é extrair dependências entre módulos (`import` estáticos e dinâmicos) sem permitir que as regras de arquitetura (`Rule`) tenham conhecimento direto de AST, parsers sintáticos, bibliotecas de terceiros ou detalhes do compilador TypeScript.

---

## 2. Decisões Arquiteturais

### 2.1 Separação Estrita de Responsabilidades e Trust Boundaries
1. **TypescriptAstCollector (`Collector`)**:
   - Atua exclusivamente em modo **READ-ONLY** utilizando o parser nativo da API do TypeScript (`typescript` compiler API - `ts.createSourceFile`).
   - É proibida qualquer execução de código (`eval`, `require`, invocação de módulos analisados).
   - Extrai declarações de importação estáticas e dinâmicas, gerando entidades `Evidence` com localização precisa (`locator.line`) e hashes de integridade (`source_hash`).
   - NUNCA gera `Finding` e NUNCA avalia regras de negócio.

2. **DependencyFactProvider (`FactProvider`)**:
   - Consome **exclusivamente `readonly Evidence[]`**.
   - É proibido acessar o filesystem, `Observation`, Git, AST raw ou invocação de parsers.
   - Normaliza caminhos de módulos de forma determinística (`source_module` e `target_module`).
   - Produz Fatos semânticos imutáveis do tipo `MODULE_DEPENDENCY`.
   - Gera `input_hash` determinístico baseado no SHA-256 das evidências de entrada ordenadas.

3. **NoDomainToInfraDependencyRule / Architecture Rules (`Rule`)**:
   - Consumidor exclusivo de `readonly Fact[]` (especificamente `MODULE_DEPENDENCY`).
   - É proibido qualquer conhecimento de AST, TypeScript, filesystem ou I/O.

### 2.2 Fato Semântico Canônico: `MODULE_DEPENDENCY`
O payload do fato é estritamente tipado:
```ts
{
  fact_type: 'MODULE_DEPENDENCY',
  source_module: string,
  target_module: string,
  import_type: 'STATIC' | 'DYNAMIC'
}
```

---

## 3. Consequências e Trade-offs

### Ganhos
* **Isolamento de Camadas**: A alteração no parser do TypeScript não afeta nenhuma regra de arquitetura.
* **Determinismo Absoluto**: Mesma evidência de código gera sempre o mesmo fato com o mesmo `input_hash`.
* **Segurança Read-Only**: Garantia total de que o código analisado é tratado como dados estáticos, nunca como código executável.

### Custos / Limitações
* Resolutores avançados de caminhos complexos (como `paths` customizados do `tsconfig.json` ou aliases de bundlers) não são adivinhados sem evidências explícitas no código.
