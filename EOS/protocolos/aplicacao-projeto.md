# Protocolo de Aplicação de Projeto — EOS

Este protocolo orienta o processo de implantação do **Engineering Operating System (EOS)** em repositórios e projetos de software já existentes. Ele garante que a adoção do framework ocorra de forma padronizada, priorizando a compreensão da arquitetura antes de qualquer alteração de código.

---

## Fluxo Geral de Implantação

```
Projeto Existente
       │
       ▼
Criar pasta .eos/
       │
       ▼
Coletar Contexto (contexto.md)
       │
       ▼
Mapear Arquitetura (arquitetura-atual.md & mapa-modulos.md)
       │
       ▼
Identificar Riscos (problemas-identificados.md)
       │
       ▼
Criar Roadmap de Evolução (roadmap.md)
       │
       ▼
Executar Melhorias (com suporte a ADRs)
```

---

## Detalhamento das Etapas

### Passo 1: Inicialização da Camada de Aplicação
Na raiz do projeto que passará a ser governado pelo EOS, crie o diretório `.eos/`. Este diretório será a base de conhecimento local e histórico técnico da aplicação.

### Passo 2: Coleta de Contexto (`contexto.md`)
O primeiro passo prático é entender o porquê do projeto existir.
* **Propósito**: Qual problema de negócio o software resolve?
* **Público-alvo**: Quem são os usuários finais?
* **Restrições de Infraestrutura**: Limites financeiros, provedores de nuvem obrigatórios, SLA requerido.
* **Fronteiras Organizacionais**: Equipe responsável, integrações críticas com sistemas externos.

### Passo 3: Mapeamento da Arquitetura (`arquitetura-atual.md` & `mapa-modulos.md`)
Sem julgamentos de valor, documente a realidade atual do sistema:
1. **Arquitetura Lógica (`arquitetura-atual.md`)**:
   * Descreva as camadas do sistema (ex: UI, Controllers, Stores, Services).
   * Documente o fluxo crítico de dados de ponta a ponta (como uma requisição chega ao banco de dados).
2. **Mapa de Módulos (`mapa-modulos.md`)**:
   * Relacione os módulos de negócio e subpastas de código.
   * Identifique as dependências entre eles (quem importa quem).

### Passo 4: Identificação de Riscos (`problemas-identificados.md`)
Analise criticamente o repositório em busca de gargalos e desvios de boas práticas usando as diretrizes de qualidade do EOS:
* **Acoplamento**: Provedores de infraestrutura (como Firebase, Supabase) importados diretamente na UI?
* **Complexidade**: Funções longas, arquivos com responsabilidades mistas, falta de tipagem/validação.
* **Segurança**: Inputs de usuários sem sanitização, vulnerabilidades de pacotes.
* **Testabilidade**: Dificuldade de mockar serviços para testes de unidade.

### Passo 5: Criação do Roadmap (`roadmap.md`)
Com base nos riscos mapeados, crie uma estratégia de melhorias estruturais ordenadas por prioridade técnica (Impacto vs. Esforço).
* **Regra de Ouro**: O roadmap não deve prever refatoração total imediata, mas sim melhorias incrementais, casadas com entregas de valor de negócio.

### Passo 6: Execução de Melhorias e ADRs
Qualquer alteração arquitetural deve ser registrada no histórico do projeto por meio de **ADRs (Architecture Decision Records)**, localizados em `.eos/decisoes/`. As melhorias devem ser feitas em branchs cirúrgicas, respeitando o princípio de **Entender Antes de Modificar**.
