# EOS — Quality Gates de Engenharia (Portões de Qualidade)

## Versão 1.0

Os **Quality Gates** são pontos de verificação obrigatórios e sequenciais que regulam o ciclo de vida do desenvolvimento. Nenhuma alteração arquitetural ou implementação de funcionalidade crítica pode ser mesclada (merge) ou considerada encerrada sem a aprovação formal de todos os gates.

---

## Fluxo de Transição dos Gates

```
[ Início ]
    │
    ▼
[ Gate 1: Contexto Completo ] 
    │
    ▼
[ Gate 2: Arquitetura Compreendida ]
    │
    ▼
[ Gate 3: Impactos e Riscos Mapeados ]
    │
    ▼
[ Gate 4: Testes & Validação Estática GREEN ]
    │
    ▼
[ Gate 5: Documentação Atualizada ]
    │
    ▼
[ Homologação / Fim ]
```

---

## 1. Gate 1 — Contexto Completo
* **Objetivo**: Garantir que a motivação de negócio e as restrições técnicas iniciais estejam claras e registradas.
* **Critérios de Aceitação**:
  * [ ] Snapshot inicial gravado em `.eos/contexto/snapshot-inicial.md` (ou equivalente).
  * [ ] O escopo físico da alteração ("Dentro do Escopo" e "Fora do Escopo") está delimitado.
  * [ ] Status: **Bloqueado** se não houver registros escritos na fase zero.

---

## 2. Gate 2 — Arquitetura Compreendida
* **Objetivo**: Garantir que a estrutura física e lógica do sistema atual foi mapeada para evitar alterações cegas.
* **Critérios de Aceitação**:
  * [ ] Mapeamento de imports e dependências das camadas afetadas concluído.
  * [ ] Identificadores únicos de descobertas (`ARQ-XXX`) criados para cada ponto de melhoria ou acoplamento detectado.
  * [ ] Status: **Bloqueado** se o desenvolvedor iniciar o código sem descrever as evidências de acoplamento detectadas no legado.

---

## 3. Gate 3 — Impactos e Riscos Mapeados
* **Objetivo**: Validar a tomada de decisão e prever riscos antes de tocar na base de código.
* **Critérios de Aceitação**:
  * [ ] Classificação e pontuação de riscos realizadas pela Matriz de Risco do EOS.
  * [ ] **Gatilho ADR**: Se a alteração for classificada como Mudança Arquitetural ou possuir risco Crítico (Score >= 6), uma ADR correspondente deve estar escrita, revisada e marcada como `Aprovada`.
  * [ ] Plano de Refatoração/Implementação estruturado em passos incrementais (baby steps).
  * [ ] Status: **Bloqueado** se houver alteração de infraestrutura ou risco crítico sem uma ADR aprovada.

---

## 4. Gate 4 — Testes e Validação Estática GREEN
* **Objetivo**: Confirmar que a implementação física é correta e não introduziu regressões.
* **Critérios de Aceitação**:
  * [ ] Compilação estática bem-sucedida (ex: `tsc --noEmit` sem erros de TypeScript).
  * [ ] Linter sem erros bloqueantes.
  * [ ] 100% dos testes unitários e de integração locais executam em verde (GREEN).
  * [ ] Testes isolados: as stores ou componentes de lógica são validados via mocks de serviços, sem dependência direta de bancos reais.
  * [ ] Status: **Bloqueado** se houver falha em qualquer teste automatizado.

---

## 5. Gate 5 — Documentação Atualizada
* **Objetivo**: Sincronizar o estado físico final do código com os registros de governança.
* **Critérios de Aceitação**:
  * [ ] Checklist de auditoria operacional preenchido e arquivado em `.eos/auditorias/`.
  * [ ] ADR correspondente atualizada com o status `Aprovada e Implementada`.
  * [ ] Log de aprendizado criado sob `.eos/aprendizados/` caso novos comportamentos ocultos ou trade-offs de design tenham surgido durante a tarefa.
  * [ ] Status: **Bloqueado** se o código for integrado à branch principal sem preenchimento do checklist tático.
