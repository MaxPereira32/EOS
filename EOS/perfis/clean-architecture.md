# Perfil Arquitetural — Clean Architecture

* **Código de Perfil**: `PROF-CLEAN-ARCH`
* **Paradigma**: Separação estrita em camadas concêntricas (Entidades, Casos de Uso, Adaptadores, Infraestrutura).

---

## 1. Características e Filosofia
A arquitetura visa a independência total de frameworks, interfaces de usuário, banco de dados e drivers externos. As entidades de domínio contêm as regras de negócio puras e não dependem de nada externo.

---

## 2. Limitações Inerentes (Aceitas sem Penalidade)
* **Quantidade Elevada de Abstrações (Boilerplate)**: Presença proeminente de interfaces, mapeadores de dados (DTOs) e fábricas para cruzar limites de camadas de forma desacoplada. **Penalidade de complexidade acidental por boilerplate = 0**.

---

## 3. Práticas Proibidas (Acoplamentos Acidentais Penalizados)
* **Vazamento de Persistência no Domínio**: Entidades de domínio importando tipos ou decoradores de ORMs (ex: imports de `@Entity`, `@Column` de typeorm ou mongoose em classes do núcleo de domínio). **Penalidade = Alta (-20 pontos)**.
* **UI Acessando Serviços de Persistência**: Componentes de visualização ou rotas acessando diretamente adaptadores de infraestrutura ou banco sem passar pela camada de Casos de Uso (Usecases). **Penalidade = Alta (-20 pontos)**.

---

## 4. Recomendações Proporcionais
* **Nível 1 (Menor esforço)**: Criar interfaces (ports) para desacoplar as chamadas externas.
* **Nível 2**: Implementar injeção de dependência via contêiner para gerenciar a inicialização dos Casos de Uso e adaptadores sem instanciá-los manualmente na UI.
