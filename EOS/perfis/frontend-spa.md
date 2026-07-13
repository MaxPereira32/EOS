# Perfil Arquitetural — Frontend SPA (React/Zustand)

* **Código de Perfil**: `PROF-FRONTEND-SPA`
* **Paradigma**: Aplicação client-side com gerenciamento de estado em memória e consumo de APIs externas.

---

## 1. Características e Filosofia
A arquitetura foca na reatividade visual e gerenciamento de estado local. A persistência física de dados ocorre fora do navegador via APIs assíncronas (REST/GraphQL/SDKs).

---

## 2. Limitações Inerentes (Aceitas sem Penalidade)
* **Reatividade Direta nos Componentes**: Acoplamento de componentes visuais React a hooks customizados de estado global (ex: `useAuthStore()`). **Penalidade de acoplamento de estado = 0**.

---

## 3. Práticas Proibidas (Acoplamentos Acidentais Penalizados)
* **Vazamento de APIs na UI**: Componentes de visualização ou telas realizando requisições assíncronas brutas com `fetch` ou `axios` inline nos componentes, ou dependendo diretamente de instâncias de SDKs físicos (ex: instâncias diretas do Firebase Firestore/Auth). **Penalidade = Alta (-20 pontos)**.
* **Mutações complexas em Stores**: Zustand stores executando chamadas físicas assíncronas do Firebase ou chamadas HTTP inline nas funções de estado (actions). **Penalidade = Média (-15 pontos)**.

---

## 4. Recomendações Proporcionais
* **Nível 1 (Menor esforço)**: Isolar as chamadas de rede e persistência externa em uma camada de serviços (`src/nucleo/servicos/`) e depender de interfaces abstratas nos gerenciadores de estado (inversão de controle).
