import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { AgentMailboxService, MailboxError } from '../core/services/agent-mailbox-service';

const TOKENS = {
  'opencode-implementer': 'opencode-token-for-ephemeral-test-only',
  'codex-headless-reviewer': 'reviewer-token-for-ephemeral-test-only',
  intruder: 'intruder-token-for-ephemeral-test-only',
} as const;
const POLICY_KEYS = crypto.generateKeyPairSync('ed25519');
const PRINCIPAL_KEYS = {
  'opencode-implementer': crypto.generateKeyPairSync('ed25519'),
  'codex-headless-reviewer': crypto.generateKeyPairSync('ed25519'),
  intruder: crypto.generateKeyPairSync('ed25519'),
} as const;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

function publicPem(key: crypto.KeyObject): string {
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

function privatePem(key: crypto.KeyObject): string {
  return key.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function signedPolicy(core: Record<string, unknown>): Record<string, unknown> {
  return {
    ...core,
    policy_signature: {
      algorithm: 'Ed25519',
      key_id: 'test-policy-key-1',
      value: crypto.sign(null, Buffer.from(stableJson(core), 'utf8'), POLICY_KEYS.privateKey).toString('base64'),
    },
  };
}

function clean(root: string): void {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-mailbox-v2-'));
  const policyPath = path.join(root, 'policy.json');
  fs.writeFileSync(policyPath, JSON.stringify(signedPolicy({
    version: 2,
    mailbox_root: root,
    principals: [
      {
        id: 'opencode-implementer', token_sha256: sha256(TOKENS['opencode-implementer']), key_id: 'opencode-key-1', public_key_pem: publicPem(PRINCIPAL_KEYS['opencode-implementer'].publicKey),
        actions: ['request', 'list', 'read'],
        routes: [{ to: 'codex-headless-reviewer', scopes: ['eos.review'] }],
      },
      {
        id: 'codex-headless-reviewer', token_sha256: sha256(TOKENS['codex-headless-reviewer']), key_id: 'reviewer-key-1', public_key_pem: publicPem(PRINCIPAL_KEYS['codex-headless-reviewer'].publicKey),
        actions: ['ack', 'status', 'review', 'list', 'read'],
        routes: [{ to: 'opencode-implementer', scopes: ['eos.review'] }],
      },
      { id: 'intruder', token_sha256: sha256(TOKENS.intruder), key_id: 'intruder-key-1', public_key_pem: publicPem(PRINCIPAL_KEYS.intruder.publicKey), actions: ['list', 'read'], routes: [] },
    ],
  }), null, 2));
  const service = (principal: keyof typeof TOKENS, token: string = TOKENS[principal]) => new AgentMailboxService({
    mailboxDir: root,
    policyPath,
    principal,
    token,
    signingKey: privatePem(PRINCIPAL_KEYS[principal].privateKey),
    policyPublicKey: publicPem(POLICY_KEYS.publicKey),
  });
  return { root, policyPath, service };
}

function assertCode(callback: () => unknown, code: string): void {
  assert.throws(callback, (error: unknown) => error instanceof MailboxError && error.code === code);
}

test('protocolo correlaciona request, ACK, status e parecer sem aprovação humana', () => {
  const { root, service } = fixture();
  try {
    const implementer = service('opencode-implementer');
    const reviewer = service('codex-headless-reviewer');
    const request = implementer.submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Solicitação de revisão', body: 'Diff e evidências anexados por referência controlada.',
      idempotencyKey: 'request-idempotency-key-0001', requestNonce: 'request-nonce-000000000001',
    });
    assert.equal(request.kind, 'REQUEST');
    assert.equal(request.status, 'PENDING');
    assert.equal(request.request_id, request.id);
    assert.match(request.issued_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(request.expires_at);

    const inbox = reviewer.list({ folder: 'inbox', limit: 10 });
    assert.deepEqual(inbox.messages.map(message => message.id), [request.id]);
    assert.equal(inbox.messages[0].contentClassification, 'UNTRUSTED_AGENT_MESSAGE');
    assert.ok(!JSON.stringify(inbox).includes('Diff e evidências'));
    assert.ok(!JSON.stringify(inbox).includes('Solicitação de revisão'));

    const ack = reviewer.acknowledge({
      requestId: request.id, status: 'RECEIVED', body: 'Recebido para revisão independente.', idempotencyKey: 'ack-idempotency-key-00000001',
    });
    const progress = reviewer.updateStatus({
      requestId: request.id, status: 'IN_PROGRESS', body: 'Análise adversarial em andamento.', idempotencyKey: 'status-idempotency-key-0001',
    });
    assertCode(() => reviewer.updateStatus({
      requestId: request.id, status: 'APPROVED', body: 'Não permitido.', idempotencyKey: 'status-idempotency-key-0002',
    }), 'E_INPUT');
    const review = reviewer.submitReview({
      requestId: request.id, subject: 'Parecer técnico', body: 'Condições e evidências registradas; decisão humana permanece necessária.',
      idempotencyKey: 'review-idempotency-key-0001',
    });
    for (const event of [ack, progress, review]) {
      assert.equal(event.request_id, request.id);
      assert.equal(event.reply_to, request.id);
      assert.equal(event.to, 'opencode-implementer');
    }
    assert.equal(review.status, 'REVIEWED');
    assert.notEqual(review.status, 'APPROVED');
    assertCode(() => reviewer.updateStatus({
      requestId: request.id, status: 'IN_PROGRESS', body: 'Não pode voltar de REVIEWED.', idempotencyKey: 'status-idempotency-key-0003',
    }), 'E_STATE_TRANSITION');
    assertCode(() => implementer.submitReview({
      requestId: request.id, subject: 'Spoof de papel', body: 'Não permitido.', idempotencyKey: 'review-idempotency-key-0002',
    }), 'E_AUTHORIZATION');
    assert.equal(implementer.read({ id: review.id }).body, review.body);
    assert.equal(implementer.list({ folder: 'inbox', limit: 10 }).messages.length, 3);
  } finally {
    clean(root);
  }
});

test('idempotência e nonce rejeitam duplicação e replay sem produzir nova mensagem', () => {
  const { root, service } = fixture();
  try {
    const implementer = service('opencode-implementer');
    const args = {
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Pedido', body: 'Conteúdo não secreto.',
      idempotencyKey: 'request-idempotency-key-0002', requestNonce: 'request-nonce-000000000002',
    };
    const first = implementer.submitRequest(args);
    const replay = implementer.submitRequest(args);
    assert.equal(replay.id, first.id);
    assert.equal(implementer.list({ folder: 'outbox', limit: 10 }).messages.length, 1);
    assertCode(() => implementer.submitRequest({ ...args, body: 'Conteúdo alterado.' }), 'E_IDEMPOTENCY_CONFLICT');
    assertCode(() => implementer.submitRequest({
      ...args,
      idempotencyKey: 'request-idempotency-key-0003',
    }), 'E_REPLAY_DETECTED');
  } finally {
    clean(root);
  }
});

test('nega spoofing, rota alheia, leitura cruzada, traversal e conteúdo sensível', () => {
  const { root, service } = fixture();
  try {
    const implementer = service('opencode-implementer');
    const intruder = service('intruder');
    const request = implementer.submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Pedido seguro', body: 'Mensagem opaca.',
      idempotencyKey: 'request-idempotency-key-0004', requestNonce: 'request-nonce-000000000004',
    });
    assertCode(() => (implementer as unknown as { submitRequest(value: unknown): unknown }).submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Spoof', body: 'Corpo',
      idempotencyKey: 'request-idempotency-key-0005', requestNonce: 'request-nonce-000000000005', from: 'codex-headless-reviewer',
    }), 'E_INPUT');
    assertCode(() => intruder.read({ id: request.id }), 'E_NOT_FOUND');
    assertCode(() => intruder.submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Não autorizado', body: 'Corpo',
      idempotencyKey: 'request-idempotency-key-0006', requestNonce: 'request-nonce-000000000006',
    }), 'E_AUTHORIZATION');
    assertCode(() => implementer.read({ id: '..\\..\\outside' }), 'E_INPUT');
    assertCode(() => implementer.submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Chave', body: 'sk-ABCDEFGHIJKLMNOPQRSTUVWX',
      idempotencyKey: 'request-idempotency-key-0007', requestNonce: 'request-nonce-000000000007',
    }), 'E_SENSITIVE_CONTENT');
  } finally {
    clean(root);
  }
});

test('detecta adulteração de mensagem e não persiste corpo em log de auditoria', () => {
  const { root, service } = fixture();
  try {
    const implementer = service('opencode-implementer');
    const request = implementer.submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Pedido de integridade', body: 'SENTINEL-BODY-MUST-NOT-APPEAR-IN-AUDIT',
      idempotencyKey: 'request-idempotency-key-0008', requestNonce: 'request-nonce-000000000008',
    });
    const audit = fs.readFileSync(path.join(root, 'audit', `AUD-${request.id}.json`), 'utf8');
    assert.ok(!audit.includes('SENTINEL-BODY-MUST-NOT-APPEAR-IN-AUDIT'));
    const file = path.join(root, 'messages', `${request.id}.json`);
    const altered = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    altered.subject = 'Alterado fora do protocolo';
    fs.writeFileSync(file, JSON.stringify(altered));
    assertCode(() => implementer.read({ id: request.id }), 'E_TAMPERED_RECORD');
  } finally {
    clean(root);
  }
});

test('falha fechada quando o evento append-only correspondente desaparece', () => {
  const { root, service } = fixture();
  try {
    const implementer = service('opencode-implementer');
    const request = implementer.submitRequest({
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Pedido auditado', body: 'Corpo de teste.',
      idempotencyKey: 'request-idempotency-key-0009', requestNonce: 'request-nonce-000000000009',
    });
    fs.rmSync(path.join(root, 'audit', `AUD-${request.id}.json`));
    assertCode(() => implementer.read({ id: request.id }), 'E_AUDIT_MISSING');
  } finally {
    clean(root);
  }
});

test('credenciais e root divergentes falham fechados', () => {
  const { root, policyPath, service } = fixture();
  try {
    assertCode(() => service('opencode-implementer', 'token-incorreto'), 'E_AUTHENTICATION');
    assertCode(() => new AgentMailboxService({
      mailboxDir: path.join(root, 'other-root'), policyPath, principal: 'opencode-implementer',
      token: TOKENS['opencode-implementer'], signingKey: privatePem(PRINCIPAL_KEYS['opencode-implementer'].privateKey), policyPublicKey: publicPem(POLICY_KEYS.publicKey),
    }), 'E_CONFIGURATION');
    assertCode(() => new AgentMailboxService({
      mailboxDir: root, policyPath, principal: 'opencode-implementer', token: TOKENS['opencode-implementer'],
      signingKey: privatePem(PRINCIPAL_KEYS['codex-headless-reviewer'].privateKey), policyPublicKey: publicPem(POLICY_KEYS.publicKey),
    }), 'E_AUTHENTICATION');
    const tamperedPolicy = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as Record<string, unknown>;
    tamperedPolicy.mailbox_root = path.join(root, 'tampered');
    fs.writeFileSync(policyPath, JSON.stringify(tamperedPolicy));
    assertCode(() => new AgentMailboxService({
      mailboxDir: root, policyPath, principal: 'opencode-implementer', token: TOKENS['opencode-implementer'],
      signingKey: privatePem(PRINCIPAL_KEYS['opencode-implementer'].privateKey), policyPublicKey: publicPem(POLICY_KEYS.publicKey),
    }), 'E_CONFIGURATION');
  } finally {
    clean(root);
  }
});
