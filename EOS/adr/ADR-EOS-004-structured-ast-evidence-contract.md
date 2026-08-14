# ADR-EOS-004 — Structured AST Evidence Contract & Canonical Module Identity

* **Status**: Aprovada
* **Autor(es)**: Senior Core Architect & Independent Auditor EOS
* **Data**: 2026-08-14
* **Decisões Relacionadas**: ADR-EOS-001, ADR-EOS-002, ADR-EOS-003

---

## 1. Contexto Técnico e Motivação

A auditoria adversarial realizada na Fase 4.1 identificou três vulnerabilidades operacionais na Fase 4.0:
1. **ACHADO-41-01**: Bypass de regras de arquitetura no Windows decorrente de comparações de caminho case-sensitive (`src/Domain/` vs `src/domain/`).
2. **ACHADO-41-02**: Fragmentação de fatos semânticos decorrente de divergência na preservação/omissão de extensões de arquivo (`.ts`, `.js`).
3. **ACHADO-41-03**: Acoplamento in-band frágil entre `TypescriptAstCollector` e `DependencyFactProvider` baseado em parsing de texto livre via expressão regular sobre o campo `snippet`.

---

## 2. Decisões Arquiteturais

### 2.1 Metadados Estruturados de AST (`ast_metadata`)
A interface `Evidence` foi estendida de forma estritamente compatível para incluir o campo opcional `ast_metadata`:

```typescript
export type AstEvidenceMetadata = {
  readonly kind: 'MODULE_IMPORT';
  readonly specifier: string;
  readonly import_type: 'STATIC' | 'DYNAMIC';
};
```

* O `TypescriptAstCollector` produz evidências contendo metadados estruturados tipados.
* O `DependencyFactProvider` consome primariamente `ev.ast_metadata`, eliminando completamente o parsing por expressão regular sobre o snippet.

### 2.2 Política de Identidade Canônica de Módulo (`normalizeModuleIdentity`)
As regras de arquitetura operam sobre uma representação canônica insensível ao casing de caminho do sistema operacional (`normalizeModuleIdentity`):
* Todos os separadores são normalizados para `/`.
* Caminhos são convertidos para minúsculo (`.toLowerCase()`) no nível de avaliação da regra (`Rule`).
* A proveniência física e as referências originais (`source_reference`, `locator`, `source_hash`) permanecem 100% preservadas e intocadas para auditoria.

### 2.3 Normalização Canônica de Target (`normalizeTargetModule`)
O `DependencyFactProvider` normaliza especificadores de módulo relativos removendo sufixos de extensões conhecidas (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`) e sufixos de índice (`/index`) na posição final do caminho, evitando duplicidade de Fatos Semânticos para o mesmo módulo em disco.

---

## 3. Consequências e Trust Boundaries

* **Trust Boundary Inviolável**: `TypescriptAstCollector` (READ-ONLY) $\to$ `Evidence` (com `ast_metadata`) $\to$ `DependencyFactProvider` (Sem I/O) $\to$ `Fact` $\to$ `Rule` (Sem I/O).
* **Eliminação de Bypass Cross-Platform**: Padrões de arquitetura funcionam de forma consistente no Windows e POSIX.
* **Eliminação de Acoplamento Frágil**: `FactProvider` não depende mais da sintaxe do snippet.
