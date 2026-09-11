import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

describe('EOS — evidência de execução do projeto', () => {
  test('registra aprovação e falha de scripts com proveniência reproduzível', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-execution-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: {
          typecheck: 'node -e "process.exit(0)"',
          lint: 'node -e "process.exit(7)"'
        }
      }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Array<{ check_id: string; state: string; exit_code: number; stdout_sha256: string }>;
      };
      const checks = service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 2);
      assert.deepStrictEqual(checks.map(check => check.state), ['PASS', 'FAIL']);
      assert.strictEqual(checks[1].exit_code, 7);
      assert.match(checks[0].stdout_sha256, /^[a-f0-9]{64}$/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('classifica ausência de scripts como evidência insuficiente', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-no-scripts-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Array<{ state: string; output_excerpt: string }>;
      };
      const checks = service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 1);
      assert.strictEqual(checks[0].state, 'NOT_AVAILABLE');
      assert.match(checks[0].output_excerpt, /Não foram encontrados scripts/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
