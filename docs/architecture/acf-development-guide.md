# Guia de Desenvolvimento ACF & ARM — EOS v0.4.0

Este guia detalha o funcionamento técnico do **Artifact Consistency Framework (ACF)** e do **Architecture Review Mode (ARM-001)**, servindo de base para a criação de novos adaptadores e controle de exceções.

---

## 1. Funcionamento do ACF (Artifact Consistency Framework)
O ACF é projetado como um framework genérico baseado em plugin e adaptadores de AST (Abstract Syntax Tree).

### Estrutura de um Adaptador
Para que o ACF compreenda uma nova tecnologia, ela deve registrar um adaptador que expõe a seguinte interface em Javascript:

```javascript
class BaseAdapter {
  constructor(name) {
    this.name = name;
  }
  
  /**
   * Coleta fatos e dependências estruturais de um arquivo específico.
   * @param {string} filePath - Caminho do arquivo.
   * @param {string} content - Conteúdo textual do arquivo.
   * @returns {Array<Object>} Fatos estruturados contendo seletores, importações ou declarações.
   */
  parse(filePath, content) {
    throw new Error("Método parse() deve ser implementado.");
  }
}
```

Os adaptadores atualmente registrados no ACF Core (`acf-core.js`):
1. **React Adapter (`react`)**: Analisa componentes React, mapeando importações de arquivos CSS e capturando o uso de classes nos atributos `className`.
2. **CSS Adapter (`css`)**: Analisa folhas de estilo CSS, extraindo seletores declarados (classes, IDs, tags) e variáveis.

O motor do ACF correlaciona a interseção entre os fatos coletados pelo Adaptador React e Adaptador CSS para computar se há estilos órfãos (arquivos CSS importados mas sem classes em uso) ou seletores inexistentes (classes referenciadas no React que não existem no CSS).

---

## 2. Architecture Review Mode (ARM-001)
O ARM-001 é o motor do EOS responsável por avaliar o risco de uma alteração e impedir correções ou refatorações cegas sem a devida documentação arquitetural.

### Ciclo de Decisão do ARM
Quando uma mudança de alto risco ($G \ge 25$) ou desvio arquitetural é identificado:

```
[Auditor/Agente] ──> Detecta Desvio Técnico ──> ARM avalia risco (G)
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼ (G < 25)                                              ▼ (G >= 25)
                  [Bypass / ARM Info]                                    [Bloqueio Interativo]
                 Registra log informativo.                                 Gera Parecer Técnico.
                                                                           Requer escrita de ADR.
                                                                           Cria registro em exceptions.json.
```

### O Repositório de Decisões (`.eos/decisoes/`)
O estado de conformidade do projeto cliente é mantido em dois arquivos centrais:

#### 1. `decisoes-historico.json`
Registra o histórico consolidado de pareceres arquiteturais gerados e aprovados pela equipe.
```json
[
  {
    "id": "ADR-001",
    "titulo": "Implementação do Architecture Review Mode",
    "data": "2026-07-15T14:20:23Z",
    "status": "APPROVED",
    "autor": "Arquiteto-Chefe",
    "consequencias": "Rastreabilidade e governança física de exceções registradas programaticamente."
  }
]
```

#### 2. `exceptions.json`
Armazena desvios de arquitetura aceitos temporariamente. Sempre que o validador do EOS encontra um desvio registrado neste arquivo, ele concede um bypass e permite que o build passe no estado **DEGRADADO** (em vez de bloquear no estado **QUARENTENA**).
```json
{
  "css_orfao": [
    "src/estilos/paginas/meuestilo-legado.css"
  ],
  "acoplamento_direto": [
    "src/infra/db/Database.ts"
  ]
}
```

---

## 3. Como Registrar uma Exceção Arquitetural
1. **Identificar o Erro**: No log do pipeline do EOS, identifique qual portão falhou (ex: `CON` devido a arquivo de estilo órfão).
2. **Avaliar Trade-off**: Se a correção imediata for inviável (ex: estilo legado que não pode ser removido), decida documentar.
3. **Escrever a ADR**: Crie um arquivo markdown sob `.eos/decisoes/ADR-XXXX-titulo.md` detalhando o contexto e as justificativas técnicas.
4. **Declarar no exceptions.json**: Adicione o caminho do arquivo ou regra na seção correspondente do `exceptions.json`. O pipeline de integração do EOS irá ler a exceção, gerando bypass automático na próxima auditoria.
