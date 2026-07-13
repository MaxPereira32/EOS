# Protocolo de Análise de Projeto — EOS

Este protocolo define o processo obrigatório que qualquer engenheiro ou agente de IA deve seguir ao assumir ou analisar um projeto de software existente (conhecido ou desconhecido) antes de sugerir ou efetuar quaisquer modificações arquiteturais ou funcionais.

---

## Passo 1: Reconhecimento do Ecossistema (Exploração Inicial)

O objetivo desta etapa é entender a finalidade do projeto e como ele está estruturado em alto nível.

1. **Leitura da Documentação Existente**:
   * Analise o `README.md` principal, wikis de documentação ou a pasta `.eos/` (se o projeto já aplicar o EOS).
2. **Varredura da Estrutura de Diretórios**:
   * Identifique as pastas principais (`src`, `public`, `tests`, `docs`, etc.).
   * Determine os limites arquiteturais básicos (monolítico, microservices, SPA/Backend separado).
3. **Análise de Dependências**:
   * Analise o manifesto do projeto (ex: `package.json`, `requirements.txt`, `Gemfile`, `go.mod`).
   * Liste as principais dependências de terceiros (frameworks, bancos de dados, state managers, SDKs de nuvem).

---

## Passo 2: Mapeamento de Arquitetura e Fluxo de Dados

O objetivo aqui é compreender como as diferentes partes do sistema interagem.

1. **Camadas de Software**:
   * Mapeie onde ficam os componentes de UI, onde a lógica de estado/aplicação é controlada e como as chamadas externas (APIs/Banco de dados) são executadas.
   * Identifique se há isolamento de responsabilidades ou se há acoplamento cruzado direto (ex: UI chamando banco de dados diretamente).
2. **Fluxo de Entrada e Saída de Dados**:
   * Trace um caminho comum do usuário (ex: submissão de um formulário ou clique de ação).
   * Documente a sequência de chamada: `Componente UI` ──> `Controller/State` ──> `Service/API` ──> `Infra/Database`.
3. **Padrões de Comunicação e Estado**:
   * Identifique como os componentes compartilham dados (Props, Contexts, Global Stores como Redux/Zustand).

---

## Passo 3: Avaliação de Qualidade e Mapeamento de Riscos

O objetivo é identificar pontos de fragilidade no sistema.

1. **Auditoria de Acoplamento**:
   * Mapeie dependências de provedores de infraestrutura (ex: se o Firebase SDK é importado diretamente nos arquivos de tela).
2. **Segurança e Validação de Dados**:
   * Verifique se as entradas do usuário são validadas de forma centralizada ou se há falhas de higienização de dados.
3. **Cobertura e Tipo de Testes**:
   * Identifique se há testes automatizados (unitários, integração, E2E) e quão confiáveis eles são para prevenir regressões durante a refatoração.
4. **Débito Técnico e Gargalos**:
   * Liste os trechos de código mais complexos, arquivos muito grandes (code smells) e gargalos de performance visíveis.

---

## Passo 4: Registro da Análise

Toda análise de projeto deve gerar um artefato técnico formal.

1. Utilize o **[Template de Análise de Arquitetura](../templates/analise-arquitetura.md)** para preencher os dados mapeados.
2. Salve o arquivo gerado em `.eos/auditorias/analise-arquitetura-[data].md` no repositório do projeto analisado.
3. Proponha um plano de ação ordenado por prioridade de impacto/esforço antes de codificar.
