import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalApplicationApiServer } from '../core/server/local-application-api-server';
import { GeneratedAppSecurityEngine } from '../core/engines/generated-app-security-engine';

// COR-03 (Fase B): validação sintática no boundary da API local.
// Usa somente caminhos 400/404 (nenhuma escrita no SecretStore do repo).

async function withServer(fn: (base: string, token: string) => Promise<void>): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor03-'));
  const server = new LocalApplicationApiServer({
    defaultPort: 0,
    portLockFilePath: path.join(dir, 'api.port'),
    sessionTokenPath: path.join(dir, 'session.token'),
  });
  const port = await server.start();
  try {
    await fn(`http://127.0.0.1:${port}`, server.getSessionToken());
  } finally {
    await server.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function request(
  base: string,
  token: string,
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      base + urlPath,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-EOS-Session-Token': token,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, json: JSON.parse(data) }));
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('CA-03-01: id/projectId inválidos rejeitados no boundary (400, sem execução)', async () => {
  await withServer(async (base, token) => {
    for (const qs of ['?id=../evil', `?id=${'x'.repeat(300)}`, '?id=AUD-1&projectId=../../x']) {
      const res = await request(base, token, 'GET', `/api/audit-history/detail${qs}`);
      assert.strictEqual(res.status, 400, qs);
      assert.match(res.json.error, /INVALID_INPUT/);
    }
  });
});

test('CA-03-02: corpos POST inválidos rejeitados antes do store (400)', async () => {
  await withServer(async (base, token) => {
    const cases: Array<[string, unknown, RegExp]> = [
      ['/api/agents/configure', {}, /providerId/],
      ['/api/agents/configure', { providerId: 'OPENAI' }, /apiKey/],
      ['/api/agents/configure', { providerId: '../evil', apiKey: 'k' }, /INVALID_INPUT/],
      ['/api/agents/configure', { providerId: 'OPENAI', apiKey: 'x'.repeat(9000) }, /apiKey/],
      ['/api/agents/test-connection', {}, /providerId/],
    ];
    for (const [urlPath, body, pattern] of cases) {
      const res = await request(base, token, 'POST', urlPath, body);
      assert.strictEqual(res.status, 400, urlPath);
      assert.match(res.json.error, pattern);
    }
  });
});

test('CA-03-03: provedor inexistente vira 404, não 500', async () => {
  await withServer(async (base, token) => {
    const res = await request(base, token, 'POST', '/api/agents/test-connection', {
      providerId: 'PROVEDOR-INEXISTENTE-XYZ',
    });
    assert.strictEqual(res.status, 404);
  });
});

test('CA-03-04: fluxo guardado por validate*() não é sinalizado pelo scanner', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor03b-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, 'server.ts'),
    [
      'const params = new URLSearchParams(url.split("?")[1] || "");',
      'const id = params.get("id") || "default";',
      'const invalid = validateIdParam(id, "id", true);',
      'if (invalid) { send(res, 400, invalid); return; }',
      'service.get(id);',
    ].join('\n'),
  );
  const result = new GeneratedAppSecurityEngine().scan(root, 'TGT-COR03', false);
  assert.ok(
    !result.findings.some(f => f.finding_id.startsWith('EOS-GENAI-INPUT-001')),
    'validação observável elimina o achado',
  );
});
