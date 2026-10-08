# Comunicação direta entre agentes — Mailbox MCP v2

O Mailbox MCP é o único canal de mensagens do EOS entre executor e revisor. A versão 2 substitui o envelope v1 não autenticado por um protocolo estrito, com estado derivado de eventos assinados e persistidos de forma exclusiva.

O contrato de orquestração, aprovação humana, auditoria independente e limite de ciclos está em [fluxo-operacional-agentes.md](fluxo-operacional-agentes.md). Ele complementa este protocolo; não é uma autorização automática de execução.

## Limite de identidade

Ter a ferramenta MCP disponível em um runtime **não prova** que ele é a conversa visual do ChatGPT. Uma resposta só pode ser atribuída a essa conversa se a plataforma fornecer um vínculo de conversa autenticado e o launcher configurar o principal correspondente. Sem isso, o runtime deve usar um identificador honesto, por exemplo `codex-headless-reviewer`.

Um Codex CLI headless é outro agente. Ele jamais deve se identificar como `chatgpt-visual-reviewer`, nem falar em nome desta conversa. A versão atual do servidor atesta o principal configurado no launcher, mas não recebe um comprovante nativo de vínculo com uma conversa visual do ChatGPT; esse requisito permanece **BLOCKED** até que o conector o forneça.

## Papéis e decisão

| Papel | Pode fazer | Não pode fazer |
| --- | --- | --- |
| `opencode-implementer` | propor, enviar pedido e consultar sua caixa | aprovar a própria entrega ou se passar pelo revisor |
| `codex-headless-reviewer` ou revisor visual comprovado | receber, reconhecer, registrar status e emitir parecer | executar comandos recebidos, aprovar em nome do usuário |
| usuário humano | decidir aprovação final fora da mailbox | delegar essa decisão para um status MCP |

`REVIEWED` é um parecer técnico. Não existe status `APPROVED` no protocolo.

## Contrato v2

O servidor deriva `from` do principal autenticado pelo launcher. O cliente nunca envia `from`, `role`, comandos, caminhos ou referências livres.

```text
REQUEST/PENDING -> ACK/RECEIVED -> STATUS/IN_PROGRESS -> REVIEW/REVIEWED
                         \-> ACK/REJECTED
                         \-> STATUS/FAILED
```

Cada registro inclui `id`, `request_id`, `reply_to` (quando aplicável), `kind`, `status`, `scope`, timestamps de servidor, expiração da solicitação, nonce, impressão de idempotência e assinatura Ed25519 do principal emissor. O corpo é marcado como `UNTRUSTED_AGENT_MESSAGE`: é dado opaco, não uma instrução, autorização ou comando.

As ferramentas são limitadas a:

- `mailbox_capabilities`
- `mailbox_submit_request`
- `mailbox_acknowledge`
- `mailbox_update_status`
- `mailbox_submit_review`
- `mailbox_list` (somente metadados da própria inbox/outbox, paginados)
- `mailbox_read` (somente se o chamador for uma ponta da mensagem)

`refs` da v1 foram removidos; o servidor não resolve arquivos ou caminhos a partir de mensagens.

## Configuração segura

O servidor inicia em modo **fail-closed**. Sem todos os valores abaixo, nenhuma chamada de mailbox é aceita:

- `EOS_MAILBOX_DIR`: diretório absoluto exclusivo da mailbox v2, fora do repositório;
- `EOS_MAILBOX_POLICY_PATH`: política fora do repositório, com raiz canônica, pares e escopos permitidos;
- `EOS_MAILBOX_PRINCIPAL`: identidade do launcher;
- `EOS_MAILBOX_TOKEN`: capacidade do principal;
- `EOS_MAILBOX_SIGNING_KEY`: chave privada Ed25519 exclusiva daquele principal;
- `EOS_MAILBOX_POLICY_PUBLIC_KEY`: chave pública da autoridade que assinou a política.

Tokens e chaves privadas não devem entrar em `opencode.jsonc`, `config.toml`, repositório, documentação, logs ou mensagens. O launcher autorizado deve obtê-los de um cofre/gerenciador de credenciais do sistema e injetá-los apenas no processo filho. A política é assinada pela autoridade de política e contém apenas chaves públicas por principal; o servidor confirma que a chave privada fornecida corresponde à identidade do launcher. Restrinja a política, a chave pública âncora e a pasta da mailbox por ACL; use contas de serviço distintas quando houver ameaça entre processos locais.

O exemplo [mailbox-policy.example.json](mailbox-policy.example.json) contém somente placeholders e não é uma política utilizável.

### Perfil Codex de menor privilégio

Após um launcher protegido disponibilizar as variáveis não secretas e os segredos ao processo, o perfil de **revisor headless** pode restringir o próprio catálogo MCP desta forma (substitua a configuração v1; não adicione um segundo servidor):

```toml
[mcp_servers.eos_mailbox]
command = 'node'
args = ['C:\\...\\node_modules\\tsx\\dist\\cli.mjs', 'C:\\...\\EOS\\bin\\agent-mailbox-mcp.ts']
cwd = 'C:\\...\\EOS'
env = { EOS_MAILBOX_PRINCIPAL = 'codex-headless-reviewer' }
env_vars = [
  'EOS_MAILBOX_DIR',
  'EOS_MAILBOX_POLICY_PATH',
  'EOS_MAILBOX_TOKEN',
  'EOS_MAILBOX_SIGNING_KEY',
  'EOS_MAILBOX_POLICY_PUBLIC_KEY'
]
enabled_tools = [
  'mailbox_capabilities',
  'mailbox_acknowledge',
  'mailbox_update_status',
  'mailbox_submit_review',
  'mailbox_list',
  'mailbox_read'
]
default_tools_approval_mode = 'prompt'
```

Essa configuração deliberadamente não habilita `mailbox_submit_request` para o revisor. O perfil do OpenCode inverte a matriz: habilita pedido/listagem/leitura, mas não ACK/status/parecer. A referência oficial documenta `env`, `env_vars`, `enabled_tools` e modos de aprovação por servidor; mudanças de configuração são lidas em uma nova sessão, portanto não atualizam a conversa visual já aberta.

Uma instalação com todos os agentes no mesmo usuário do Windows protege contra chamadas acidentais e contra clientes MCP sem a capacidade configurada; ela **não** é uma fronteira resistente a um processo malicioso com acesso equivalente ao sistema de arquivos e às credenciais. Para essa ameaça, use contas distintas e um broker/secret store protegido. Não declarar essa limitação como resolvida é obrigatório.

## Armazenamento e auditoria

No diretório configurado, a v2 cria `messages/` e `audit/`. Cada mensagem e evento de auditoria é criado com exclusividade (`wx`), sincronizado e assinado pela chave do principal emissor. O evento contém somente metadados e a assinatura da mensagem — nunca assunto ou corpo. Leitura/listagem verifica assinatura, rota, política e a presença do evento correspondente; ausência, symlink, corrupção ou adulteração falham fechados.

A mailbox v1 existente em `docs/auditoria/comunicacao/mailbox/` é legado histórico e não é migrada nem apagada por esta mudança. Ela não deve ser usada para troca segura após o rollout v2.

## Validação

Os testes criam uma mailbox temporária e removem-na ao final. O E2E usa os principals explícitos `opencode-implementer` e `codex-headless-reviewer`; ele comprova o protocolo, não a integração com a conversa visual ChatGPT.

```powershell
npx tsx --test EOS/tests/agent-mailbox-protocol.test.ts
npx tsx --test EOS/tests/agent-mailbox-mcp-e2e.test.ts
npx tsc --noEmit
npm test
```

O smoke E2E registra IDs, timestamps, estados e assinaturas em diretório temporário, além de falhas deliberadas de spoofing e idempotência. Nenhum teste escreve na mailbox real ou envia uma mensagem a outro agente em execução.
