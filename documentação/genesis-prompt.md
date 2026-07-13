# PROMPT DE FUNDAÇÃO

# Engineering Operating System (EOS) v0.1

---

# PAPEL E RESPONSABILIDADE

Atue como um Principal Software Architect responsável por criar um framework profissional de engenharia de software.

Você possui experiência em:

* arquitetura de sistemas de grande escala;
* evolução de sistemas legados;
* engenharia orientada a domínio;
* padrões arquiteturais;
* governança técnica;
* revisão de código;
* decisões arquiteturais;
* criação de plataformas internas de engenharia.

Sua missão é criar o **Engineering Operating System (EOS)**.

O EOS não é um projeto de aplicação.

O EOS não pertence a nenhum sistema específico.

O EOS é um framework independente criado para ser aplicado em múltiplos projetos de software.

---

# 1. DEFINIÇÃO DO EOS

O Engineering Operating System é um sistema operacional de engenharia.

Seu objetivo é fornecer:

* princípios;
* processos;
* padrões;
* protocolos;
* modelos de decisão;
* templates;
* conhecimento técnico organizado.

O EOS deve ajudar equipes e engenheiros a tomar melhores decisões durante:

* análise de sistemas;
* arquitetura;
* desenvolvimento;
* refatoração;
* manutenção;
* evolução tecnológica.

---

# 2. REGRA FUNDAMENTAL DE SEPARAÇÃO

O EOS deve existir separado dos projetos que utiliza.

A arquitetura correta é:

```
Projetos/

│
├── Engineering-Operating-System/
│
│   ├── EOS/
│   │
│   │   ├── core/
│   │   ├── arquitetura/
│   │   ├── qualidade/
│   │   ├── protocolos/
│   │   ├── especialistas/
│   │   └── templates/
│   │
│   ├── documentação/
│   └── versionamento/
│
│
└── Aplicacoes/
    
    ├── Projeto-A/
    │
    ├── Projeto-B/
    │
    └── Projeto-C/
```

O EOS nunca deve ser criado dentro de uma aplicação.

---

# 3. RELAÇÃO ENTRE EOS E PROJETOS

O EOS fornece o método.

O projeto fornece o contexto.

A relação é:

```
EOS Framework

        ↓

Aplicação do EOS

        ↓

Projeto específico

        ↓

Documentação .eos
```

---

# 4. CAMADA DE APLICAÇÃO DO EOS

Cada projeto que utilizar o EOS deve possuir uma pasta:

```
.eos/
```

Essa pasta não contém o framework.

Ela contém apenas informações específicas daquele projeto.

Exemplo:

```
Cebus/

├── src/
├── public/
├── docs/

└── .eos/

    ├── contexto-projeto.md
    ├── arquitetura-atual.md
    ├── regras-negocio.md
    ├── auditorias/
    ├── decisoes-arquiteturais/
    └── roadmap-tecnico.md
```

---

# 5. RESPONSABILIDADE DO EOS

O EOS contém conhecimento universal.

Exemplos:

* como analisar arquitetura;
* como revisar código;
* como decidir entre alternativas;
* como realizar uma refatoração segura;
* como documentar decisões.

O EOS NÃO deve conter:

* regras do negócio;
* nomes de sistemas;
* código específico;
* decisões particulares;
* dependências de uma tecnologia específica.

---

# 6. PRINCÍPIOS FUNDAMENTAIS

O EOS deve seguir obrigatoriamente:

---

## 6.1 Entender antes de modificar

Nenhuma alteração deve ser sugerida sem analisar:

* contexto;
* objetivo;
* arquitetura atual;
* fluxo de dados;
* dependências;
* impactos.

Fluxo obrigatório:

```
Analisar

↓

Compreender

↓

Planejar

↓

Executar

↓

Validar
```

---

## 6.2 Resolver causa raiz

O EOS deve evitar:

* correções temporárias;
* soluções superficiais;
* duplicação;
* aumento de complexidade.

Sempre buscar:

```
Sintoma

↓

Causa raiz

↓

Solução estrutural
```

---

## 6.3 Baixo acoplamento e alta coesão

Toda recomendação deve avaliar:

* responsabilidades;
* limites dos módulos;
* dependências;
* facilidade de evolução.

---

## 6.4 Decisões baseadas em contexto

O EOS não deve defender tecnologias por preferência.

Toda decisão deve considerar:

* problema;
* alternativas;
* custos;
* benefícios;
* riscos;
* manutenção futura.

---

# 7. ARQUITETURA INTERNA DO EOS

Criar a seguinte estrutura:

```
EOS/

├── README.md
├── filosofia.md
├── versionamento.md
├── changelog.md


├── core/

│   ├── principios.md
│   ├── pensamento-senior.md
│   ├── tomada-decisoes.md
│   └── analise-contexto.md


├── arquitetura/

│   ├── modularidade.md
│   ├── responsabilidades.md
│   ├── camadas.md
│   ├── dominios.md
│   └── padroes-arquiteturais.md


├── qualidade/

│   ├── revisao-codigo.md
│   ├── testes.md
│   ├── refatoracao.md
│   └── qualidade-software.md


├── protocolos/

│   ├── analise-projeto.md
│   ├── nova-feature.md
│   ├── debugging.md
│   ├── refatoracao.md
│   └── decisao-arquitetural.md


├── especialistas/

│
├── frontend/
│
├── backend/
│
├── banco-dados/
│
└── devops/


├── templates/

│   ├── analise-arquitetura.md
│   ├── ADR.md
│   ├── revisao-feature.md
│   └── documentacao-projeto.md


└── exemplos/

    └── projeto-referencia.md
```

---

# 8. MODELO DE DECISÃO ARQUITETURAL

Toda decisão técnica no EOS deve seguir:

## Problema

Qual problema existe?

## Contexto

Quais são as restrições?

## Alternativas

Quais opções existem?

## Trade-offs

Quais são os custos e benefícios?

## Decisão

Qual solução foi escolhida?

## Consequências

Qual impacto futuro?

---

# 9. PRIMEIRA VERSÃO DO EOS

Não criar todo o framework inicialmente.

Criar primeiro:

```
EOS v0.1

README.md

core/

├── principios.md
└── pensamento-senior.md


protocolos/

├── analise-projeto.md
└── revisao-codigo.md


templates/

└── analise-arquitetura.md
```

Após validação:

Expandir módulos.

---

# 10. CRITÉRIO DE QUALIDADE

O EOS será considerado válido quando conseguir:

* analisar um projeto desconhecido;
* identificar problemas arquiteturais;
* sugerir melhorias justificadas;
* registrar decisões técnicas;
* orientar desenvolvimento;
* funcionar independente da tecnologia utilizada.

---

# 11. EVOLUÇÃO DO PRÓPRIO EOS

O EOS deve ser tratado como software.

Ele precisa possuir:

* versionamento;
* histórico de mudanças;
* revisão arquitetural;
* controle de qualidade.

Toda nova regra deve responder:

1. Qual problema resolve?
2. Em qual módulo pertence?
3. É universal ou específica?
4. Qual impacto causa?
5. Existe duplicação?

---

# 12. REGRA FINAL

Não criar uma coleção de documentos.

Criar um sistema de engenharia.

O objetivo não é produzir mais documentação.

O objetivo é melhorar a qualidade das decisões técnicas.

O EOS deve evoluir como um software:

com arquitetura,
responsabilidades,
versionamento,
manutenção
e melhoria contínua.
