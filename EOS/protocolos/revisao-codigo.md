# Protocolo de Revisão de Código (Code Review) — EOS

Este protocolo define os critérios e o comportamento esperado durante o processo de Code Review (Revisão de Código). O objetivo da revisão é garantir a integridade arquitetural do sistema, mitigar riscos de produção e promover o aprendizado mútuo, mantendo a consistência do código.

---

## 1. Princípios do Revisor

* **Foco no Design e Arquitetura**: Priorize revisar o fluxo de dados, acoplamento, limites de camadas e modularidade. Linters e formatadores automáticos cuidam de espaçamento, vírgulas e estilo básico de sintaxe.
* **Comunicação Construtiva**: Formule comentários em formato de pergunta ou sugestão construtiva em vez de ordens diretas. Justifique sempre *o porquê* de uma alteração sugerida baseado em princípios objetivos de engenharia.
* **Egoless Review**: Lembre-se de que a crítica é direcionada ao código, não ao autor. O objetivo comum é a resiliência e a evolução sustentável do software.

---

## 2. Checklist Sistemático de Revisão

Durante a revisão de um Pull Request (PR), valide os seguintes aspectos:

### A. Conformidade Arquitetural e Princípios EOS
- [ ] **Desacoplamento**: A alteração respeita os limites das camadas (ex: UI não acessa infraestrutura diretamente)?
- [ ] **Coesão**: Novas classes ou funções têm responsabilidade única e clara?
- [ ] **Duplicação**: A implementação introduz lógica repetida que deveria ser reaproveitada ou extraída?
- [ ] **Resolução de Causa Raiz**: Se o PR corrige um bug, ele ataca a causa real ou apenas esconde o sintoma?

### B. Legibilidade e Manutenibilidade
- [ ] **Nomenclatura Semântica**: Nomes de variáveis, funções e componentes explicam claramente sua intenção sem a necessidade de comentários explicativos?
- [ ] **Complexidade Ciclomática**: Existem condicionais (`if/else`) aninhados excessivamente? A lógica pode ser simplificada usando Early Return ou guard clauses?
- [ ] **Código Morto**: Há variáveis criadas e não utilizadas, logs de debug esquecidos ou arquivos temporários?

### C. Confiabilidade e Testes
- [ ] **Testabilidade**: A estrutura lógica implementada permite a escrita de testes unitários sem dificuldades (ex: ausência de side-effects ocultos)?
- [ ] **Presença de Testes**: Novas funcionalidades ou correções de bugs cruciais possuem testes automatizados que comprovam seu funcionamento?
- [ ] **Cenários de Erro**: O código prevê cenários alternativos (ex: falhas de rede, dados nulos, timeouts) ou assume apenas o "caminho feliz"?

### D. Segurança e Performance
- [ ] **Higienização de Entradas**: Há risco de injeção de dados maliciosos ou falhas de segurança básicas (XSS, SQL Injection)?
- [ ] **Gestão de Recursos**: Há possíveis vazamentos de memória (memory leaks), como assinaturas não canceladas em hooks de efeitos colaterais (`useEffect` / observables)?
- [ ] **Operações Custosas**: Laços de repetição desnecessários dentro de ciclos de renderização ou consultas ineficientes ao banco de dados foram evitados?

---

## 3. Classificação de Comentários

Para otimizar o tempo de aprovação, use prefixos de urgência nos seus comentários:

* **[CRÍTICO]**: Problema de segurança, bug lógico latente, desvio grave de padrão arquitetural ou regressão de performance. **Bloqueia o merge** até ser resolvido.
* **[SUGESTÃO]**: Alternativa de design mais limpa ou refatoração benéfica, mas que não causa quebras. Fica a critério de discussão entre autor e revisor. **Não bloqueia o merge**.
* **[DÚVIDA]**: Pergunta para entender melhor a intenção do autor ou funcionamento de trecho complexo. **Bloqueia o merge** até esclarecimento.
* **[ELOGIO]**: Destaque para uma solução elegante ou código bem escrito. Incentive as boas práticas da equipe.
