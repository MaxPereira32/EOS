# Modelo de Instância — EOS

Este documento estabelece o **Modelo de Instância do Engineering Operating System (EOS)**, definindo formalmente as fronteiras conceituais e estruturais entre a base universal de conhecimento do framework e sua aplicação concreta em projetos específicos.

---

## 1. Os Dois Estados do EOS

Para manter a governança clara e evitar o acoplamento de documentações ou regras específicas de negócio no núcleo técnico, o EOS opera estritamente sob dois estados distintos:

```
┌────────────────────────────────────────────────────────┐
│                     EOS Framework                      │
│                  (Conhecimento Universal)              │
│  - princípios    - protocolos    - templates  - modelos│
└───────────────────────────┬────────────────────────────┘
                            │ (Instanciação)
                            ▼
┌────────────────────────────────────────────────────────┐
│                      EOS Instance                      │
│                  (Instância de Projeto)                │
│  - contexto      - arquitetura   - decisões   - roadmap│
└────────────────────────────────────────────────────────┘
```

---

## 2. EOS Framework (O Núcleo Universal)

O **EOS Framework** representa a biblioteca de conhecimento, processos e ferramentas de engenharia independentes de domínio.

* **Localização**: Fica sob o diretório `EOS/` no repositório do framework.
* **Propriedade**: É compartilhado entre toda a organização de engenharia.
* **Componentes Obrigatórios**:
  * **Princípios (`core/`)**: Regras fundamentais e indiscutíveis de design, qualidade e postura de engenharia.
  * **Protocolos (`protocolos/`)**: Guias passo a passo executáveis (ex: como realizar code reviews ou análise de novos projetos).
  * **Modelos (`modelos/`)**: Ferramentas analíticas e tabelas de diagnóstico (ex: matriz de acoplamento, modelo de maturidade).
  * **Templates (`templates/`)**: Modelos de documentos prontos para cópia e preenchimento (ex: template de ADR).
* **Regra de Ouro**: Nenhuma regra de negócio, nome de banco de dados específico, variável de ambiente ou propriedade de infraestrutura de uma aplicação cliente deve ser registrada nesta camada.

---

## 3. EOS Instance (A Instância Aplicada)

A **EOS Instance** representa o estado vivo e aplicado do framework em um produto ou serviço real da empresa.

* **Localização**: Fica sob a pasta `.eos/` na raiz do repositório de cada projeto consumidor.
* **Propriedade**: Pertence à equipe dona do produto e evolui com o ciclo de vida do software correspondente.
* **Componentes Obrigatórios**:
  * **Contexto (`contexto-projeto.md` e `contexto/snapshot-inicial.md`)**: O propósito de negócio, restrições, limites da aplicação e o registro de estado estático inicial de tarefas.
  * **Arquitetura (`arquitetura-atual.md` e `mapa-modulos.md`)**: Mapeamento real, lógico e físico da base de código.
  * **Regras de Negócio (`regras-negocio.md`)**: Mapeamento das leis de negócio fundamentais que o software implementa.
  * **Decisões (`decisoes/`)**: Histórico de ADRs (Architecture Decision Records) específicos do projeto.
  * **Auditorias (`auditorias/`)**: Diagnósticos e relatórios arquiteturais passados.
  * **Roadmap (`roadmap-tecnico.md`)**: Plano de ação detalhado para melhorias estruturais do projeto.
  * **Aprendizados (`aprendizados/`)**: Histórico e catalogação de conhecimento adquirido e lições aprendidas a cada tarefa finalizada.

---

## 4. Governança e Evolução

1. **Separação de Ciclos**: O EOS Framework é atualizado com versionamento semântico centralizado. A EOS Instance de cada projeto é atualizada de forma independente, acompanhando os commits do próprio software.
2. **Dogfooding**: O próprio repositório do EOS Framework possui a sua própria EOS Instance na raiz (pasta `.eos/`) para registrar suas decisões de design como produto de documentação.
