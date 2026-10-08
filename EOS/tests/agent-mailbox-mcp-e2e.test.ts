import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { test } from 'node:test';

const TOKENS = {
  'opencode-implementer': 'opencode-token-for-ephemeral-mcp-e2e',
  'codex-headless-reviewer': 'reviewer-token-for-ephemeral-mcp-e2e',
} as const;
const POLICY_KEYS = crypto.generateKeyPairSync('ed25519');
const PRINCIPAL_KEYS = {
  'opencode-implementer': crypto.generateKeyPairSync('ed25519'),
  'codex-headless-reviewer': crypto.generateKeyPairSync('ed25519'),
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
      algorithm: 'Ed25519', key_id: 'e2e-policy-key-1',
      value: crypto.sign(null, Buffer.from(stableJson(core), 'utf8'), POLICY_KEYS.privateKey).toString('base64'),
    },
  };
}

interface RpcClient {
  readonly call: (method: string, params?: unknown) => Promise<Record<string, unknown>>;
  readonly close: () => Promise<void>;
}

function createClient(principal: keyof typeof TOKENS, root: string, policyPath: string): RpcClient {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const child = spawn(process.execPath, [
    path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(repoRoot, 'EOS', 'bin', 'agent-mailbox-mcp.ts'),
  ], {
    env: {
      ...process.env,
      EOS_MAILBOX_DIR: root,
      EOS_MAILBOX_POLICY_PATH: policyPath,
      EOS_MAILBOX_PRINCIPAL: principal,
      EOS_MAILBOX_TOKEN: TOKENS[principal],
      EOS_MAILBOX_SIGNING_KEY: privatePem(PRINCIPAL_KEYS[principal].privateKey),
      EOS_MAILBOX_POLICY_PUBLIC_KEY: publicPem(POLICY_KEYS.publicKey),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams;
  let nextId = 1;
  let buffer = '';
  const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const response = JSON.parse(line) as { id?: number; result?: Record<string, unknown>; error?: { message?: string } };
      if (typeof response.id !== 'number') continue;
      const waiter = pending.get(response.id);
      if (!waiter) continue;
      pending.delete(response.id);
      if (response.error) waiter.reject(new Error(response.error.message ?? 'JSON-RPC failure'));
      else waiter.resolve(response.result ?? {});
    }
  });
  child.on('exit', code => {
    for (const waiter of pending.values()) waiter.reject(new Error(`Mailbox MCP exited unexpectedly (${code}).`));
    pending.clear();
  });
  const call = (method: string, params?: unknown): Promise<Record<string, unknown>> => new Promise((resolve, reject) => {
    const id = nextId++;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}.`));
    }, 10_000);
    pending.set(id, {
      resolve: value => { clearTimeout(timeout); resolve(value); },
      reject: error => { clearTimeout(timeout); reject(error); },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  return {
    call,
    close: () => new Promise(resolve => {
      if (child.exitCode !== null) { resolve(); return; }
      child.once('exit', () => resolve());
      child.stdin.end();
    }),
  };
}

function toolPayload(result: Record<string, unknown>): { payload: Record<string, unknown>; isError: boolean } {
  const toolResult = result as { content?: Array<{ text?: string }>; isError?: boolean };
  const text = toolResult.content?.[0]?.text;
  assert.equal(typeof text, 'string');
  return { payload: JSON.parse(text as string) as Record<string, unknown>, isError: toolResult.isError === true };
}

async function tool(client: RpcClient, name: string, argumentsValue: Record<string, unknown> = {}): Promise<{ payload: Record<string, unknown>; isError: boolean }> {
  return toolPayload(await client.call('tools/call', { name, arguments: argumentsValue }));
}

test('smoke MCP E2E não destrutivo: OpenCode -> ACK/status/parecer de runtime headless correlacionado', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-mailbox-mcp-e2e-'));
  const policyPath = path.join(root, 'policy.json');
  fs.writeFileSync(policyPath, JSON.stringify(signedPolicy({
    version: 2,
    mailbox_root: root,
    principals: [
      { id: 'opencode-implementer', token_sha256: sha256(TOKENS['opencode-implementer']), key_id: 'e2e-opencode-key-1', public_key_pem: publicPem(PRINCIPAL_KEYS['opencode-implementer'].publicKey), actions: ['request', 'list', 'read'], routes: [{ to: 'codex-headless-reviewer', scopes: ['eos.review'] }] },
      { id: 'codex-headless-reviewer', token_sha256: sha256(TOKENS['codex-headless-reviewer']), key_id: 'e2e-reviewer-key-1', public_key_pem: publicPem(PRINCIPAL_KEYS['codex-headless-reviewer'].publicKey), actions: ['ack', 'status', 'review', 'list', 'read'], routes: [{ to: 'opencode-implementer', scopes: ['eos.review'] }] },
    ],
  })));
  const opencode = createClient('opencode-implementer', root, policyPath);
  const headlessReviewer = createClient('codex-headless-reviewer', root, policyPath);
  try {
    await opencode.call('initialize', { protocolVersion: '2024-11-05' });
    await headlessReviewer.call('initialize', { protocolVersion: '2024-11-05' });
    const capability = await tool(headlessReviewer, 'mailbox_capabilities');
    assert.equal(capability.isError, false);
    assert.equal(capability.payload.principal, 'codex-headless-reviewer');
    assert.equal(capability.payload.humanApproval, 'OUT_OF_BAND_REQUIRED');

    const requestResult = await tool(opencode, 'mailbox_submit_request', {
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Revisão independente solicitada', body: 'Avaliar evidências e riscos; não decidir aprovação humana.',
      idempotencyKey: 'e2e-request-idempotency-0001', requestNonce: 'e2e-request-nonce-00000001',
    });
    assert.equal(requestResult.isError, false);
    const requestId = requestResult.payload.id as string;
    assert.match(requestId, /^MSG-[a-f0-9]{32}$/);

    const spoof = await tool(opencode, 'mailbox_submit_request', {
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Spoof', body: 'Não deve gravar.',
      idempotencyKey: 'e2e-request-idempotency-0002', requestNonce: 'e2e-request-nonce-00000002', from: 'chatgpt-visual-reviewer',
    });
    assert.equal(spoof.isError, true);
    assert.equal((spoof.payload.error as Record<string, unknown>).code, 'E_INPUT');

    const inbox = await tool(headlessReviewer, 'mailbox_list', { folder: 'inbox', limit: 10 });
    assert.equal(inbox.isError, false);
    const messages = inbox.payload.messages as Array<Record<string, unknown>>;
    assert.deepEqual(messages.map(message => message.id), [requestId]);
    assert.ok(!JSON.stringify(inbox.payload).includes('Avaliar evidências'));

    const ack = await tool(headlessReviewer, 'mailbox_acknowledge', {
      requestId, status: 'RECEIVED', body: 'Recebido.', idempotencyKey: 'e2e-ack-idempotency-000000001',
    });
    const status = await tool(headlessReviewer, 'mailbox_update_status', {
      requestId, status: 'IN_PROGRESS', body: 'Revisão em curso.', idempotencyKey: 'e2e-status-idempotency-000001',
    });
    const review = await tool(headlessReviewer, 'mailbox_submit_review', {
      requestId, subject: 'Parecer do runtime headless', body: 'Parecer técnico emitido; aprovação humana não ocorreu.',
      idempotencyKey: 'e2e-review-idempotency-000001',
    });
    for (const result of [ack, status, review]) {
      assert.equal(result.isError, false);
      assert.equal(result.payload.request_id, requestId);
      assert.equal(result.payload.reply_to, requestId);
      assert.match(result.payload.issued_at as string, /^\d{4}-\d{2}-\d{2}T/);
    }
    assert.equal(review.payload.status, 'REVIEWED');

    const duplicate = await tool(opencode, 'mailbox_submit_request', {
      to: 'codex-headless-reviewer', scope: 'eos.review', subject: 'Revisão independente solicitada', body: 'Avaliar evidências e riscos; não decidir aprovação humana.',
      idempotencyKey: 'e2e-request-idempotency-0001', requestNonce: 'e2e-request-nonce-00000001',
    });
    assert.equal(duplicate.isError, false);
    assert.equal(duplicate.payload.id, requestId);

    const outbox = await tool(opencode, 'mailbox_list', { folder: 'outbox', limit: 10 });
    assert.equal(outbox.isError, false);
    assert.equal((outbox.payload.messages as unknown[]).length, 1);
    assert.ok(fs.readdirSync(path.join(root, 'audit')).length >= 5);
  } finally {
    await Promise.all([opencode.close(), headlessReviewer.close()]);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
