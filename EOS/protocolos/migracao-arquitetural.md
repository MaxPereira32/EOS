# Protocolo de Migração Arquitetural — EOS

Este protocolo orienta o processo de migração de componentes estruturais de grande escala de um sistema, tais como a substituição de provedores de persistência (ex: migrar de Firebase para MySQL), troca de gerenciadores de estado global ou substituição de frameworks de UI.

---

## 1. Antes da Migração (Preparação e Contratos)

Migrações arquiteturais possuem alto impacto e exigem blindagem de contratos de dados para não quebrar a aplicação ativa.

1. **Desenho de Contratos Abstratos (DIP)**:
   * Antes de tocar no código do novo provedor, defina interfaces TypeScript ou classes abstratas estritas que representem as operações necessárias (ex: `IFornecedorRepository`).
   * Desacople as camadas superiores (UI e Stores), fazendo-as depender exclusivamente destas interfaces abstratas, nunca de implementações físicas.
2. **Mapeamento de Dados e Esquemas**:
   * Mapeie a compatibilidade dos tipos de dados entre a infraestrutura antiga e a nova (ex: como campos Firestore `Timestamp` serão representados no MySQL `DATETIME`).
3. **Análise de Riscos**:
   * Preencha a **[Matriz de Risco Arquitetural](../modelos/matriz-risco.md)** para avaliar o impacto da migração.
4. **Registro de Decisão (ADR)**:
   * Escreva um **ADR** fundamentando a mudança, detalhando os trade-offs, custos de migração, benefícios a longo prazo e alternativas consideradas.

---

## 2. Durante a Migração (Estratégias de Transição)

Evite migrações do tipo "Big Bang" (virar a chave de uma vez só sem redundância). Prefira transições graduais.

1. **Padrão Branch por Abstração**:
   * Implemente o novo provedor sob uma nova classe (ex: `FornecedorMysqlService` que assina a mesma interface de `FornecedorFirebaseService`).
   * Mantenha ambas as implementações coexistindo na base de código.
2. **Estratégia de Escrita Dupla (Dual Write) / Homologação Paralela**:
   * Em sistemas críticos de dados, configure a aplicação para gravar nos dois bancos de dados simultaneamente (banco ativo e novo banco em teste).
   * Valide a integridade física dos dados no novo banco sem desligar o antigo.
3. **Alternância via Feature Toggles (Configurações)**:
   * Utilize variáveis de ambiente ou flags de configuração (toggles) para alternar o consumo entre o provedor antigo e o novo. Isso permite reverter a migração instantaneamente caso ocorram anomalias.

---

## 3. Depois da Migração (Cleanup e Fechamento)

Após a migração consolidada em ambiente de homologação e produção por um período de segurança:

1. **Monitoramento e Observabilidade**:
   * Acompanhe logs de erros estruturados no painel de observabilidade.
   * Monitore a latência das novas chamadas de banco e integridade de dados.
2. **Desativação do Provedor Antigo (Cleanup)**:
   * Delete as classes de implementação antigas, dependências inúteis do manifesto (`package.json`) e configurações de infraestrutura obsoletas.
   * Mantenha a interface abstrata intacta para garantir que a UI e o estado global não sofram impactos.
3. **Fechamento do ADR**:
   * Atualize o status do ADR da migração para `Aprovada` e registre as lições aprendidas no changelog da instância.
