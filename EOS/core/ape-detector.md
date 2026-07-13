# Architectural Profile Engine (APE) — Detector de Perfil

O **Architectural Profile Engine (APE)** é o subsistema do EOS responsável pelo mapeamento inicial e classificação do perfil arquitetural e da stack técnica de um projeto. 

O APE atua como um tradutor de contexto para que o auditor (humano ou agente cognitivo) adapte dinamicamente as regras, penalidades e recomendações antes de iniciar qualquer avaliação arquitetural.

---

## 1. Matriz de Classificação Baseada em Evidências

O APE proíbe inferências subjetivas. A classificação em um ou mais perfis deve ser baseada em **evidências físicas** encontradas na estrutura do repositório:

| Perfil Arquitetural | Evidências Físicas de Identificação (Assinaturas) | Regras EOS Primárias Aplicáveis |
| :--- | :--- | :--- |
| **MVC clássico / ActiveRecord** | `composer.json` com `laravel/framework`, `Gemfile` com `rails`, ou `requirements.txt` com `django`. Presença de arquivos herdando de `Controller` e classes de modelo herdando de ORM nativo (`Eloquent\Model`, `ActiveRecord\Base`). | Adaptação de acoplamento de persistência simples em controladores. Valorização da separação Controller ──> View. |
| **Clean Architecture / Hexagonal / Onion** | Diretórios estruturados como `domain/`, `core/`, `entities/`, `usecases/`, `adapters/`, `ports/`. Presença proeminente de interfaces puras definindo limites de entrada e saída. | Isolamento absoluto das entidades de domínio de qualquer framework ou SDK. Inversão de dependência rígida. |
| **Frontend SPA (React/Vue/Zustand)** | `package.json` com `react` ou `vue`. Ausência de rotas de servidor no projeto. Utilização de gerenciadores de estado em memória (Zustand, Redux) no client-side. | Isolamento de chamadas de API externas em camadas de adaptadores de serviços. Testabilidade por mocks. |
| **SSR / Next.js App Router** | `package.json` com `next`. Presença de diretório `src/app/` com arquivos de rota `page.tsx`, `layout.tsx` e `route.ts`. | Diferenciação entre React Server Components (RSC) e Client Components (`use client`). |
| **Biblioteca / CLI** | `package.json` com exports de build (`main`, `module`, `types`), ou arquivos como `src/cli.ts` ou `artisan`. Ausência de views ou interfaces visuais complexas. | Alta coesão, baixíssimo acoplamento externo, e foco em API pública enxuta e testabilidade de utilitários. |

---

## 2. Rito de Execução do APE (Onboarding)

Antes de preencher o checklist de auditoria ou calcular métricas, o auditor deverá rodar as seguintes etapas de diagnóstico:

```
Passo 1: Varredura de Configuração (package.json, composer.json, etc.)
                   │
                   ▼
Passo 2: Análise de Diretórios (Verificar pastas de domínio vs. apresentação)
                   │
                   ▼
Passo 3: Mapeamento de Dependências (Verificar ORMs, State Managers, HTTP Clients)
                   │
                   ▼
Passo 4: Emissão do Perfil Técnico e Ativação de Regras Condicionais
```

### Protocolo de Saída de Contexto
A auditoria técnica é bloqueada se o Onboarding não declarar explicitamente:
1. **Perfis Identificados**: Ex: `[MVC clássico, Laravel ActiveRecord]`
2. **Framework & Versão**: Ex: `Laravel 5.5`
3. **Limitações Inerentes**: Ex: `ActiveRecord requer acoplamento físico do model à tabela do banco de dados.`
4. **Regras Adaptadas**: Ex: `Permitir consultas simples (ex: Produto::find()) fora da camada de dados; penalizar apenas SQL cru ou queries complexas inline no Controller.`
