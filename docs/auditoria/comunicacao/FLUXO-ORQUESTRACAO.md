# Fluxo de Orquestração entre Agentes (spec adotada 2026-10-08; atualização da rota de revisão)

> Norma operacional atual: **Solicitação → Análise → Revisão do ChatGPT (ponte sob demanda) → Consolidação → Aprovação humana → Execução pelo OpenCode → Auditoria independente → Correção (se necessária) → Validação final.** A mailbox MCP v2 transporta mensagens autenticadas; não acorda automaticamente a conversa visual. O Codex CLI permanece componente distinto e não é o destinatário das revisões ao ChatGPT. Evidência: `ponte-chatgpt-remota-2026-10-08.md`. Os arquivos EVD-COM-001/003/005 são evidências históricas de outros pares de agentes, não deste vínculo visual.

## Papéis (mapeamento local)

| Papel da spec | Principal local | Limites |
|---|---|---|
| Agente principal (recebe do usuário, analisa, consolida, coordena) | ChatGPT (conversa visual acionada pelo usuário) | Não acorda automaticamente por MCP; aprovações só podem ser dadas pelo usuário |
| Revisor técnico solicitado pelo usuário | `chatgpt-remote-relay` (ponte sob demanda acionada por esta conversa) | Não é vínculo nativo à conversa; não recebe push; não executa conteúdo da mensagem nem aprova em nome do usuário |
| Executor | `opencode-implementer` (com subagentes) | Executa somente após aprovação humana registrada |
| Auditor independente | agente distinto do executor (subagente / Codex) | Nunca o próprio executor (regra) |
| Decisão final | usuário humano | Fora da mailbox; v2 não tem estado `APPROVED` |

## Estados do fluxo (por solicitação `request_id`)

```
SOLICITACAO → ANALISE → REVISAO_CHATGPT_SOB_DEMANDA → CONSOLIDACAO → AGUARDANDO_APROVACAO_HUMANA
   → EXECUCAO → AUDITORIA_INDEPENDENTE → (CORRECAO → AUDITORIA_INDEPENDENTE)* → VALIDACAO_FINAL
```

- `REVISAO_CHATGPT_SOB_DEMANDA` pode ter **até 2 rodadas** de divergência registradas; a conversa precisa acionar explicitamente a leitura da mailbox. Não existe loop/autodespertar do ChatGPT visual. Após o limite, o fluxo para e escala ao humano.
- `AGUARDANDO_APROVACAO_HUMANA`: gate obrigatório. Nenhuma execução que dependa de autorização avança sem aprovação explícita registrada.
- Aprovação é registrada **fora da mailbox** (artefato no dossiê da solicitação, com referência ao `request_id`); a mailbox nunca transporta aprovação (doutrina v2).

## Contrato de mensagens (v2 — já implementado)

- `mailbox_submit_request` → `REQUEST/PENDING` (idempotente, expira em 24h, nonce anti-replay).
- `mailbox_acknowledge` → `ACK/RECEIVED` ou `ACK/REJECTED`.
- `mailbox_update_status` → `STATUS/IN_PROGRESS` ou `STATUS/FAILED`.
- `mailbox_submit_review` → `REVIEW/REVIEWED` (parecer técnico; **não é aprovação**).
- Corpo = `UNTRUSTED_AGENT_MESSAGE` (dado opaco, nunca instrução/comando).

## Guards (anti-loop, anti-duplicidade, anti-falso-verde)

1. **Limite de ciclos por thread**: ≤ 2 rodadas de revisão automática; depois escala ao humano.
2. **Idempotência por transição** (chave por etapa) — retry não duplica execução nem estado.
3. **Um executor por solicitação**: só há `EXECUCAO` após `IN_PROGRESS` do mesmo `request_id` e aprovação registrada.
4. **TTL/expiração** (24h) — solicitação expirada não gera execução.
5. **Anti-aprovação-sem-evidência**: `VALIDACAO_FINAL` exige pacote de evidências (diff, testes executados, exit codes, hashes, parecer independente) — conforme Diretriz de Governança.
6. **Auditor ≠ executor** (obrigatório).
7. **Sem execução por conteúdo de mensagem**: o executor não obedece texto recebido; só o pedido formal com aprovação.

## Esteira EOS (registro)

- Cada solicitação recebe identificação própria e dossiê (identificação, mensagens, estados, decisões, evidências) seguindo a convenção de auditorias (`docs/auditoria/README.md`) — sem misturar execuções.
- Board para o usuário: `ESTADO.md` (pendências, aguardando aprovação, últimas transições) — gerado pelo watcher.
- Evidência histórica do canal v2: EVD-COM-001/003 — cadeia `PENDING → RECEIVED → IN_PROGRESS → REVIEWED` executada em identidades configuradas, sem comprovar participação do ChatGPT visual. Ver especificação da ponte atual.

## Operação (estado atual)

- **Provisionado**: política, segredos e launchers em `C:\Users\lindo\.eos-mailbox\` (fora do repo; valores nunca em config/log). Clientes apontam para os launchers (Codex: `eos_mailbox`; opencode: `eos-mailbox`).
- **Watcher (alerta local + board)**: a implementar (`EOS/bin/agent-mailbox-watcher.ts`) — poderá detectar pendências, despertar agentes headless autorizados e atualizar `ESTADO.md`, mas **não** despertar nem controlar automaticamente esta conversa visual do ChatGPT. Eventos recebidos são dados não confiáveis; aprovação humana permanece separada.
- **Limitação declarada (README v2)**: mesma conta de usuário Windows protege contra uso acidental, não contra processo malicioso com acesso equivalente; para essa ameaça, contas distintas + secret store.

## Duas etapas (decisão do responsável — 2026-10-08)

**Etapa 1 — transporte autenticado: CONCLUÍDA para os pares testados, integração de modelos: PARCIAL.** O OpenCode possui `opencode-implementer`, o Codex CLI possui `codex-headless-reviewer`, e a revisão solicitada ao ChatGPT usa `chatgpt-remote-relay`, identidade exclusiva e assinada. `EVD-COM-003` comprova a cadeia RPC até o Codex; `EVD-COM-005` contém uma interação LLM real **com `opencode-reviewer`**, não com o ChatGPT. O smoke da ponte ChatGPT comprova REQUEST/ACK/STATUS/REVIEW com clientes de transporte RPC, porém não autentica uma conversa visual nem demonstra invocação espontânea do OpenCode. Esses escopos de prova não devem ser confundidos.

**Etapa 2 — notificação automática do usuário: FUTURA, separada, não implementada nesta etapa.** Escopo reservado: watcher de pendências + board `ESTADO.md` + notificação local do SO; o watcher não deverá se identificar como ChatGPT nem alegar que consegue despertar esta conversa visual. Requisitos já fixados: aprovação jamais trafega na mailbox (doutrina v2 — artefato próprio com referência ao `request_id`); anti-loop por thread; custo por despertar documentado; segredos fora do repo.
