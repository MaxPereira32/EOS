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
        executeProjectChecks(targetPath: string): Promise<Array<{ check_id: string; state: string; exit_code: number; failure_cause?: string; stdout_sha256: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 2);
      assert.deepStrictEqual(checks.map(check => check.state), ['PASS', 'FAIL']);
      assert.strictEqual(checks[1].exit_code, 7);
      assert.strictEqual(checks[1].failure_cause, 'TEST_FAILED');
      assert.strictEqual(checks[0].failure_cause, undefined);
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

  test('classifica binário ausente como ferramenta indisponível, não como teste reprovado', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-tooling-missing-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: { test: 'eos-definitely-missing-binary-xyz --run' }
      }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ state: string; failure_cause?: string; exit_code: number }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks[0].state, 'NOT_AVAILABLE');
      assert.strictEqual(checks[0].failure_cause, 'TOOLING_MISSING');
      assert.notStrictEqual(checks[0].exit_code, 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('gate de execução fica inconclusivo, não FAIL, quando o binário do script está ausente', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-execution-gate-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: { test: 'eos-definitely-missing-binary-xyz --run' }
      }));
      const report = await new AuditApplicationService().executeAudit(root, path.join(root, '.eos'));

      const executionRule = report.rule_results.find(rule => rule.rule_id === 'EOS-EXECUTION-001');
      assert.strictEqual(executionRule?.status, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(report.overall_phase_status, 'BLOCKED');
      const evidence = report.execution_evidences?.find(item => item.command_line === 'npm run test');
      assert.strictEqual(evidence?.state, 'NOT_AVAILABLE');
      assert.strictEqual(evidence?.failure_cause, 'TOOLING_MISSING');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('executa check externo declarado no eos.risk.yml e registra evidência', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-check-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  external_checks:',
        '    - name: ok-check',
        '      argv: ["node", "-e", "process.exit(0)"]',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string; failure_cause?: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 1);
      assert.match(checks[0].command_line, /^node -e /);
      assert.strictEqual(checks[0].state, 'PASS');
      assert.strictEqual(checks[0].failure_cause, undefined);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('check externo reprovado vira FAIL com causa TEST_FAILED', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-fail-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  external_checks:',
        '    - name: fail-check',
        '      argv: ["node", "-e", "process.exit(3)"]',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ state: string; exit_code: number; failure_cause?: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks[0].state, 'FAIL');
      assert.strictEqual(checks[0].exit_code, 3);
      assert.strictEqual(checks[0].failure_cause, 'TEST_FAILED');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('check externo com binário ausente vira NOT_AVAILABLE/TOOLING_MISSING', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-missing-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  external_checks:',
        '    - name: missing-check',
        '      argv: ["eos-definitely-missing-binary-xyz", "--run"]',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ state: string; failure_cause?: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks[0].state, 'NOT_AVAILABLE');
      assert.strictEqual(checks[0].failure_cause, 'TOOLING_MISSING');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('ignora check externo sem nome válido ou sem argv e mantém os válidos', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-invalid-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  external_checks:',
        '    - name: bad name with spaces',
        '      argv: ["node", "-e", "process.exit(0)"]',
        '    - name: empty-argv',
        '      argv: []',
        '    - name: valid-check',
        '      argv: ["node", "-e", "process.exit(0)"]',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 1);
      assert.match(checks[0].command_line, /^node -e /);
      assert.strictEqual(checks[0].state, 'PASS');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('suporta argv em lista multilinha no eos.risk.yml', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-multiline-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  external_checks:',
        '    - name: multiline-check',
        '      argv:',
        '        - node',
        '        - -e',
        '        - process.exit(0)',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ state: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks[0].state, 'PASS');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('respeita timeout específico por nome de check externo', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-timeout-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  default_timeout_ms: 300',
        '  check_timeouts_ms:',
        '    "slow-ext": 5000',
        '  external_checks:',
        '    - name: slow-ext',
        '      argv: ["node", "-e", "setTimeout(() => process.exit(0), 600)"]',
        '    - name: quick-ext',
        '      argv: ["node", "-e", "setTimeout(() => process.exit(9), 600)"]',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string; failure_cause?: string }>>;
      };
      const checks = await service.executeProjectChecks(root);
      const slow = checks.find(check => check.command_line.includes('process.exit(0)'));
      const quick = checks.find(check => check.command_line.includes('process.exit(9)'));

      assert.strictEqual(slow?.state, 'PASS', 'slow-ext deve passar dentro do timeout declarado');
      assert.strictEqual(quick?.state, 'FAIL');
      assert.strictEqual(quick?.failure_cause, 'TIMEOUT');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('checks externos não dependem de package.json', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-external-nopkg-'));
    try {
      fs.writeFileSync(path.join(root, 'eos.risk.yml'), [
        'execution:',
        '  external_checks:',
        '    - name: standalone-check',
        '      argv: ["node", "-e", "process.exit(0)"]',
        '',
      ].join('\n'));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ command_line: string; state: string }>>;
      };
      const checks = await service.executeProjectChecks(root);

      assert.strictEqual(checks.length, 1);
      assert.match(checks[0].command_line, /^node -e /);
      assert.strictEqual(checks[0].state, 'PASS');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('redige credenciais do excerpt sem alterar os hashes de saída', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-redaction-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        scripts: { typecheck: 'node -e "console.log(\'DATABASE_URL=postgres://user:secret@localhost:5432/app\')"' }
      }));
      const service = new AuditApplicationService() as unknown as {
        executeProjectChecks(targetPath: string): Promise<Array<{ output_excerpt: string; stdout_sha256: string }>>;
      };
      const check = (await service.executeProjectChecks(root))[0];
      assert.doesNotMatch(check.output_excerpt, /secret|postgres:\/\/user/i);
      assert.match(check.output_excerpt, /\[REDACTED\]/);
      assert.match(check.stdout_sha256, /^[a-f0-9]{64}$/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

});
