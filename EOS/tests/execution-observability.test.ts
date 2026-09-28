import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

test('emite heartbeat enquanto um quality gate continua em execução', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-heartbeat-'));
  const previousHeartbeat = process.env.EOS_CHECK_HEARTBEAT_MS;
  const originalLog = console.log;
  const messages: string[] = [];
  try {
    process.env.EOS_CHECK_HEARTBEAT_MS = '250';
    console.log = (...args: unknown[]) => { messages.push(args.map(String).join(' ')); };
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { typecheck: 'node -e "setTimeout(() => process.exit(0), 700)"' }
    }));
    const service = new AuditApplicationService() as unknown as {
      executeProjectChecks(targetPath: string): Promise<Array<{ state: string }>>;
    };
    const checks = await service.executeProjectChecks(root);

    assert.strictEqual(checks[0].state, 'PASS');
    assert.ok(messages.some(message => message.includes('[EOS][CHECK] ▶ npm run typecheck')));
    assert.ok(messages.some(message => message.includes('em execução')));
    assert.ok(messages.some(message => message.includes('npm run typecheck PASS')));
  } finally {
    console.log = originalLog;
    if (previousHeartbeat === undefined) delete process.env.EOS_CHECK_HEARTBEAT_MS;
    else process.env.EOS_CHECK_HEARTBEAT_MS = previousHeartbeat;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('timeout encerra o gate e produz evidência FAIL sem bloquear a auditoria', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-timeout-'));
  const previousTimeout = process.env.EOS_CHECK_TIMEOUT_MS;
  try {
    process.env.EOS_CHECK_TIMEOUT_MS = '300';
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { typecheck: 'node -e "setTimeout(() => process.exit(0), 5000)"' }
    }));
    const service = new AuditApplicationService() as unknown as {
      executeProjectChecks(targetPath: string): Promise<Array<{
        state: string;
        exit_code: number;
        output_excerpt: string;
      }>>;
    };

    const checks = await service.executeProjectChecks(root);

    assert.strictEqual(checks[0].state, 'FAIL');
    assert.strictEqual(checks[0].exit_code, -1);
    assert.match(checks[0].output_excerpt, /Tempo limite excedido/);
  } finally {
    if (previousTimeout === undefined) delete process.env.EOS_CHECK_TIMEOUT_MS;
    else process.env.EOS_CHECK_TIMEOUT_MS = previousTimeout;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
