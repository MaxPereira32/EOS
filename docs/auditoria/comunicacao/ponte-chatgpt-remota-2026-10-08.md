# Ponte sob demanda OpenCode ↔ EOS ↔ ChatGPT — 2026-10-08

## Decisão operacional
Por solicitação do usuário, pedidos de revisão ao assistente da conversa devem ser dirigidos ao principal `chatgpt-remote-relay`, **não ao Codex CLI**. O canal é acionado pelo ChatGPT quando esta conversa usa o Desktop Commander Remote. Não há vínculo de sessão visual autenticado e não há listener/push para disparar automaticamente mensagens na conversa.

## Implementação efetiva (fora do repositório)
- Política assinada: `%USERPROFILE%\.eos-mailbox\policy.json`; rota `opencode-implementer -> chatgpt-remote-relay` e resposta `chatgpt-remote-relay -> opencode-implementer`, escopo `eos.review`.
- Principal do relay: `chatgpt-remote-relay`, ações `ack,status,review,list,read`. Não possui capacidade de criar solicitações, aprovar execução, executar código ou se passar pelo Codex.
- Segredos exclusivos: `%USERPROFILE%\.eos-mailbox\secrets\chatgpt-relay.token` e `chatgpt-relay.signkey.pem`, não persistidos no Git. Chave pública incorporada à política assinada.
- Launcher: `%USERPROFILE%\.eos-mailbox\launcher\agent-mailbox-chatgpt-relay.ps1`.
- Cliente sob demanda: `%USERPROFILE%\.eos-mailbox\launcher\chatgpt-relay-cli.cjs`. Acessado por meio do Desktop Commander Remote na conversa, não via execução arbitrária do texto de uma mensagem.
- Instruções de roteamento: `%USERPROFILE%\.config\opencode\AGENTS.md`, seção "Comunicação de revisão com ChatGPT pela ponte remota EOS".
- Foi preservada cópia da política anterior; os principais e rotas históricos do Codex continuam presentes para validação das mensagens antigas. A orientação operacional nova não envia revisões destinadas ao ChatGPT para o Codex.

## Evidências verificadas
- Teste do protocolo MCP preexistente: 7 testes passaram, 0 falharam, com clientes de teste.
- Configuração real do OpenCode: `opencode mcp list` indicou `eos-mailbox connected`.
- Codex CLI: servidor habilitado, mas execução do agente real interrompida por limite de uso; deixou de ser dependência da nova ponte.
- Provisionamento do novo principal: `PROVISIONED chatgpt-remote-relay ... policy_signature_verified true`.
- Smoke do transporte em 2026-10-08 (clientes RPC reais usando launchers de identidades reais, conteúdo **sintético**):
  - REQUEST: `MSG-8968e626c11cbbcfb7b970c24ced5fe0`
  - ACK: `MSG-8aa7007067099c8375461908a9ce573b`
  - STATUS: `MSG-96ab20d28f714c12a449b38f78cb5354`
  - REVIEW: `MSG-96b88dd019e2aa8bbfb21baad1f605fd`
  - Parecer recuperado pela inbox do OpenCode; todas as mensagens correlacionadas pelo requestId.
- Cliente da ponte consultou `mailbox_capabilities`: principal autenticado `chatgpt-remote-relay`; leitura de inbox listou o pedido de teste.

## Não comprovado / limites
1. **Sem push para ChatGPT visual:** mensagens enviadas pelo OpenCode não iniciam ou acordam esta conversa sozinhas. É necessário executar o cliente via Desktop Commander nesta conversa, ou obter integração de notificação autenticada pela plataforma.
2. **Sem atestação nativa de identidade visual:** `chatgpt-remote-relay` prova autenticação do principal local, não vincula o processo a esta thread ChatGPT. O usuário deve tratar o relay como uma ponte sob demanda, nunca como conexão autônoma.
3. **Sem E2E autônomo de agentes:** não foi comprovado que o processo da IA OpenCode chamou espontaneamente `mailbox_submit_request` para o relay e leu o parecer; o smoke prova somente o caminho RPC e sua segurança de transporte.
4. **Sem aprovação humana via mailbox:** `REVIEWED` é opinião, não `APPROVED`. Implantação, commit/push e mudanças relevantes exigem aprovação explícita do usuário.
5. **Risco residual de isolamento local:** OpenCode e relay executam sob o mesmo usuário Windows; a proteção criptográfica não substitui isolamento do sistema operacional frente a um processo local malicioso com acesso aos mesmos arquivos.

## Próximos critérios de aceitação
- [x] Principal exclusivo do relay, rotas assinadas e verificação de capacidade.
- [x] REQUEST → ACK → STATUS → REVIEW com assinatura e `request_id` correlacionado.
- [x] Cliente de consulta/revisão acionável pela conversa via Desktop Commander.
- [x] Instruções do OpenCode orientadas ao relay para pedidos de revisão ao ChatGPT.
- [ ] Executar com o **modelo OpenCode real** um novo REQUEST para o relay e comprovar que ele leu a resposta.
- [ ] Implementar um mecanismo de notificação explícita e autenticada se desejado; não alegar push autônomo sem prova.
- [ ] Aplicar testes de ACL/isolamento e rotação de credenciais antes de operação multiusuário.


## Revalidação independente — 2026-10-08 (continuação)

### 1. Proveniência das evidências informadas pelo OpenCode

- `EVD-COM-003-e2e-protocolo-v2e-limpo.txt`: sequência real de mensagens JSON-RPC usando launchers autenticados `opencode-implementer` e `codex-headless-reviewer`. Prova transporte e armazenamento; não comprova análise de LLM Codex.
- `EVD-COM-005-e2e-dois-agentes.txt`: execução do modelo OpenCode `deepseek-v4.1-flash` com identidade `opencode-reviewer`, chamada de ferramenta, parecer e leitura de volta. Não prova envolvimento da sessão visual do ChatGPT; não prova independência de fornecedores.
- `EVD-COM-006-suite-completa.txt`: registro histórico de `npm test` com 187 testes, 186 PASS, 0 FAIL, 1 SKIP, exit=0.

### 2. Validação executada novamente por este revisor

- `node_modules/.bin/tsc.cmd --noEmit`: `TYPECHECK_EXIT=0`.
- `npm.cmd test`: `TEST_EXIT=0`, 187 tests, 186 PASS, 0 FAIL, 1 SKIP.
- Log bruto de execução fresca (na estação local): `%TEMP%\\eos-chatgpt-validation-20261008-130445.log`.
- O teste ignorado não integra a comprovação desta rota ChatGPT; não se deve registrar a suíte como 187/187 aprovada.

### 3. Tentativa controlada com agente OpenCode real

- CLI testada com `opencode run --agent plan --dir <pasta-temporaria> --format json`; solicitação para `chatgpt-remote-relay`, escopo `eos.review`. Sem saída do modelo ou nova mensagem observada.
- Outra tentativa com `opencode run --attach http://127.0.0.1:54276 --agent build --model opencode-go/deepseek-v4.1-flash --dir <pasta-temporaria>` também não produziu saída observável nem `REQUEST` esperado durante a verificação.
- `GET http://127.0.0.1:54276/global/health` respondeu HTTP 200 com `healthy: true`, versão `1.18.35`. Isso prova funcionamento do servidor HTTP, **não** execução da inferência nem invocação MCP por agente.
- Veredicto: `BLOCKED / NOT VERIFIED` para o caminho **OpenCode LLM real → mailbox → ChatGPT sob demanda → OpenCode LLM real**. Causa da ausência de execução do agente ainda não determinada; não presumir falha da mailbox.

### 4. Correção documental

- `FLUXO-ORQUESTRACAO.md` foi atualizado para indicar ChatGPT como interlocutor principal, `chatgpt-remote-relay` como rota da revisão sob demanda, OpenCode como executor, Codex CLI fora da rota padrão solicitada, e ausência de push para ChatGPT visual.
- A política mantém rotas históricas de Codex/OpenCode-reviewer para preservar compatibilidade dos registros antigos; não interpretá-las como seleção padrão do fluxo atual.
- Não houve edição de código de negócio nem commit/push nesta etapa.


### 5. Novo achado após primeira tentativa de LLM

A solicitação de teste do primeiro `opencode run --agent plan` apareceu mais tarde na mailbox real, apesar dos logs STDOUT/STDERR do processo terem permanecido vazios. O assunto possui o nonce único `LIVE_MODEL_RELAY_cca01db037184aa0a6d8747740599465`, correspondente à chamada iniciada nesta revisão:

- REQUEST assinado pelo principal `opencode-implementer`: `MSG-fb80c3cf5a0d30fe69f2963e8f8fcadc`, emitido em `2026-10-08T16:00:45.170Z`. Leitura autenticada `mailbox_read` passou.
- ACK emitido pelo revisor `chatgpt-remote-relay`: `MSG-323c3ff682a2224faaf072dd52f17248`.
- STATUS/IN_PROGRESS: `MSG-9d2c356bf83687c820dccf97c1ae4e7d`.
- REVIEW/REVIEWED: `MSG-fbd08d1c0175389a2d85b7bc788a9475`; parecer desta conversa, sem aprovação de implementação.
- A correspondência do assunto único com o prompt do OpenCode fornece evidência da solicitação no teste ao vivo; os logs do processo continuam sem demonstrar a chamada da ferramenta. Ainda é necessário comprovar o **consumo do REVIEW pelo modelo OpenCode**.
- Não há evidência de acionamento automático desta conversa por mensagem. O revisor consultou e respondeu manualmente, usando Desktop Commander no turno vigente.
