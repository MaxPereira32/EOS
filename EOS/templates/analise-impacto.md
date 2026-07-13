# Análise de Impacto — [Nome da Proposta/Mudança]

* **ADR Relacionado**: [ADR-XXXX]
* **Autor(es)**: [Nome/Perfil do Autor]
* **Data**: [AAAA-MM-DD]

---

## 1. Descrição da Alteração Proposta

*Descreva em alto nível a modificação que será introduzida no sistema. É uma atualização de biblioteca? Uma mudança no esquema de dados? Uma nova integração?*

---

## 2. Mapeamento de Dependências e Arquivos Afetados

*Liste os componentes, arquivos ou microsserviços que importam ou dependem direta e indiretamente do trecho a ser alterado.*

* **Arquivos Diretamente Afetados**:
  * [Caminho do arquivo 1]
  * [Caminho do arquivo 2]
* **Módulos Indiretos/Consumidores**:
  * [Módulo A] — Ex: Consome a store `X` que passará por modificação.

---

## 3. Avaliação de Impactos de Segunda Ordem

Avalie as consequências da alteração contra os seguintes pilares operacionais do sistema:

### 3.1 Performance e Bundle Size
* *A alteração aumenta o tamanho do build final?*
* *Introduz processamentos pesados ou bloqueantes no thread principal?*
* **Avaliação**: [Sim / Não / Descreva o impacto esperado]

### 3.2 Resiliência e Operação Offline
* *A mudança interfere na persistência local ou IndexedDB do navegador?*
* *Como o sistema se comporta caso a rede falhe durante a execução deste novo fluxo?*
* **Avaliação**: [Descreva]

### 3.3 Quebra de Contratos e APIs
* *Os contratos de dados (tipos, esquemas Zod) ou APIs expostas serão alterados?*
* *Exige atualização em outros repositórios/bancos de dados?*
* **Avaliação**: [Descreva]

---

## 4. Matriz de Riscos e Mitigações

Identifique o que pode dar errado durante a implantação e defina as salvaguardas necessárias:

| Risco Mapeado | Probabilidade (B/M/A) | Impacto (B/M/A) | Ação de Mitigação |
| :--- | :---: | :---: | :--- |
| **Ex: Falha na sincronização offline** | Média | Alta | Testar exaustivamente desligando a rede local (`Network panel offline` do Chrome DevTools) antes do deploy. |
| **Ex: Build quebrado devido a tipos obsoletos** | Baixa | Média | Executar TypeScript compiler (`tsc --noEmit`) localmente. |
