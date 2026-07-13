# Prompt Operacional: Implementação Controlada

Utilize este prompt para orientar a implementação física de qualquer alteração de código (seja uma refatoração estrutural, correção de bug ou nova funcionalidade) após a aprovação de seu respectivo plano de ação ou ADR.

---

## Diretrizes Fundamentais de Execução

Você deve seguir o princípio do EOS de **alterações incrementais protegidas por salvaguardas**. Nenhuma alteração deve ser executada de forma global e direta.

### 🚫 PROIBIÇÕES CRÍTICAS
* **NÃO refatore múltiplos módulos ao mesmo tempo.** Trabalhe em um módulo por vez.
* **NÃO crie abstrações prematuras** (interfaces, wrappers) se não houver um plano claro e imediato de uso.
* **NÃO altere regras de negócio** ou cálculos consolidados sem autorização explícita registrada em ADR.
* **NÃO remova códigos ou imports** sem comprovar analiticamente que não existem dependências indiretas em runtime.

---

## Ciclo de Desenvolvimento em 3 Fases

### Fase 1: Preparação (Antes do Código)
Antes de digitar qualquer linha de código, você deve estruturar e validar as seguintes informações com o arquiteto/usuário:
1. **Objetivo Claro**: Qual é a melhoria esperada no final do processo?
2. **Arquivos Afetados**: Identifique exatamente quais arquivos serão editados ou criados.
3. **Mapeamento de Impacto**: Quais módulos vizinhos ou telas podem sofrer efeitos colaterais?
4. **Análise de Risco**: O que pode falhar em runtime e qual é o plano de mitigação imediato?
5. **Estratégia de Execução**: Qual o roteiro de baby steps a ser seguido?

### Fase 2: Execução (Alterações Incrementais)
Execute as mudanças físicas obedecendo às seguintes regras:
1. **Passos de Implementação Mínimos**: Realize uma alteração localizada por vez (ex: crie o arquivo de serviço, depois atualize o contrato de tipos, depois altere o consumo).
2. **Validação Contínua**: A cada passo concluído, execute o TypeScript compiler (`tsc --noEmit`), o linter (`eslint`) e os testes unitários do módulo afetado.
3. **Preservação de Comportamento**: Garanta que as assinaturas e o funcionamento externo dos métodos permaneçam intactos para evitar quebras em cascata nos arquivos consumidores.
4. **Evite Mudanças Paralelas**: Se encontrar outro bug ou débito técnico durante a tarefa, registre-o no backlog para resolução futura. Não tente resolvê-lo nesta tarefa.

### Fase 3: Validação (Depois do Código)
A implementação só é considerada aceita quando as seguintes etapas forem superadas:
1. **Bateria de Testes**: Todos os testes unitários e de integração existentes rodam com sucesso.
2. **Estabilidade de Comportamento**: Teste manualmente o fluxo do usuário no navegador ou nos ambientes de teste e certifique-se de que a regra operacional (ex: cálculos, ordenações) está correta e inalterada.
3. **Ausência de Novos Acoplamentos**: Verifique se a mudança não importou de forma indevida dependências de infraestrutura na UI ou camadas puras.
4. **Atualização da Documentação**: Atualize os mapas de módulos (`mapa-modulos.md`) ou diagramas arquiteturais para refletir a nova estrutura da base de código.
