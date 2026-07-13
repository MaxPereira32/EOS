# Perfil Arquitetural — Next.js SSR (App Router)

* **Código de Perfil**: `PROF-NEXTJS-SSR`
* **Paradigma**: Renderização híbrida (Server e Client Components) com App Router.

---

## 1. Características e Filosofia
A arquitetura combina renderização no servidor (RSC) com interatividade no cliente. O fluxo de dados busca simplificar a comunicação eliminando APIs intermediárias através de Server Actions ou consultas de banco diretas nos Server Components.

---

## 2. Limitações Inerentes (Aceitas sem Penalidade)
* **Busca de Dados em Server Components**: Consultas de dados estáticos ou assíncronos diretamente em Server Components (ex: ler arquivos locais ou chamar bancos de dados em `page.tsx`). **Penalidade de persistência = 0**.

---

## 3. Práticas Proibidas (Acoplamentos Acidentais Penalizados)
* **Import de código exclusivo do servidor no cliente**: Importação de bibliotecas exclusivas de servidor (ex: `fs`, `path`, database drivers) em componentes declarados com `'use client'`. **Penalidade = Alta (-20 pontos)**.
* **Falta de isolamento de variáveis de ambiente**: Utilização de chaves secretas de infraestrutura no client-side sem o prefixo `NEXT_PUBLIC_`. **Penalidade = Alta (-20 pontos)**.

---

## 4. Recomendações Proporcionais
* **Nível 1 (Menor esforço)**: Isolar chamadas de infraestrutura pesada em arquivos de utilitários de dados (`src/services/` ou `src/lib/`) marcados com `'use server'` e expô-los de forma limpa.
