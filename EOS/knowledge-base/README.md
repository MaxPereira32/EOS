# EOS — Base de Conhecimento e Lições Aprendidas

## Versão 1.0

Este repositório atua como a memória técnica da engenharia do EOS. Ele consolida aprendizados reais, refatorações de referência e soluções aplicadas em projetos do ecossistema, servindo como fonte de consulta para evitar erros recorrentes.

---

## 1. Refatorações de Referência (Padrões Ouro)

### 1.1 Desacoplamento de Estado Global e Infraestrutura (Firebase/Firestore)
* **Contexto**: Em um projeto real de demonstração, a fábrica de stores Zustand (`criarStoreCrud.ts`) importava e executava operações diretamente via SDK do Firebase.
* **Solução Aplicada**:
  1. Criação de uma interface genérica de serviço:
     ```typescript
     export interface CrudServico<T> {
       obterTodos: () => Promise<T[]>;
       salvar: (dados: Omit<T, 'id'> & { id?: string }) => Promise<T>;
       excluir: (id: string) => Promise<void>;
     }
     ```
  2. Alteração da fábrica para receber a implementação do serviço:
     ```typescript
     export const criarStoreCrud = <T>(servico: CrudServico<T>) => { ... }
     ```
  3. Injeção do serviço concreto (ex: `servicoProduto`) no momento da instanciação da store em `useProdutoStore.ts`.
* **Resultado**: 100% de isolamento tecnológico. As stores e componentes de UI ficaram agnósticos de provedor. Testes unitários de estado passaram a rodar de forma síncrona/assíncrona simples via mocks de serviço (sem simular SDK do Firebase).

---

## 2. Erros Recorrentes (O que Evitar)

1. **Importação Dinâmica de Stores em Camada de Serviços**:
   * *Caso*: No módulo de Entradas, o arquivo `servicoEntrada.ts` realizava `import('../estados/useEntradaStore')` para obter o último registro e gerar o sequencial de ID.
   * *Correção Recomendada*: O ID sequencial deve ser resolvido na persistência (banco de dados) ou passado como parâmetro puro da função, evitando que a camada de serviços dependa do estado global do Zustand.

2. **Mocks Pesados de SDKs de Banco nos Testes**:
   * *Caso*: Antes da refatoração, os testes da store exigiam simulação mockada profunda de conexões de banco Firestore, gerando fragilidade e testes de mais de 100 linhas apenas para preparação de ambiente.
   * *Correção*: Isolar as stores por injeção de contratos de serviço, permitindo realizar mocks diretos de promessas de JS simples.
