import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

describe('EOS — evidência de execução do projeto', () => {
  test('registra aprovação e falha de scripts com proveniência reproduzível', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-execution-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: {
          typecheck: 'node -e "process.exit(0)"',
          lint: 'node -e "process.exit(7)"'
        }
      }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ check_id: string; state: string; exit_code: number; stdout_sha256: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 2);
      assert.deepStrictEqual(checks.map(check => check.state), ['PASS', 'FAIL']);
      assert.strictEqual(checks[1].exit_code, 7);
      assert.match(checks[0].stdout_sha256, /^[a-f0-9]{64}$/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('classifica ausência de scripts como evidência insuficiente', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-no-scripts-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ state: string; output_excerpt: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 1);
      assert.strictEqual(checks[0].state, 'NOT_AVAILABLE');
      assert.match(checks[0].output_excerpt, /Não foram encontrados scripts/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('executa validação de produção declarada no eos.risk.yml', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-production-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: { 'release:validate': 'node -e "process.exit(0)"' }
      }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), 'production:\n  release_validation_script: "release:validate"\n');
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string }>>;
      };
      const check = (await service.executeProjectChecks(root)).find(item => item.command_line === 'npm run release:validate');
      assert.strictEqual(check?.state, 'PASS');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('falha fechado quando o perfil de produção declara script inexistente', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-production-missing-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), 'production:\n  release_validation_script: "release:validate"\n');
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string }>>;
      };
      const check = (await service.executeProjectChecks(root)).find(item => item.command_line === 'npm run release:validate');
      assert.strictEqual(check?.state, 'NOT_AVAILABLE');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('prefere test:all e executa test de manifesto backend aninhado', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-multimanifest-'));
    try {
      fs.mkdirSync(path.join(root, 'backend'));
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: {
          test: 'node -e "process.exit(9)"',
          'test:all': 'node -e "process.exit(0)"'
        }
      }));
      fs.writeFileSync(path.join(root, 'backend', 'package.json'), JSON.stringify({
        scripts: { test: 'node -e "process.exit(0)"' }
      }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.ok(checks.some(item => item.command_line === 'npm run test:all' && item.state === 'PASS'));
      assert.ok(checks.some(item => item.command_line === 'npm --prefix backend run test' && item.state === 'PASS'));
      assert.ok(!checks.some(item => item.command_line === 'npm run test'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

});
