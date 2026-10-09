import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

// COR-04 (Fase A): CLI anuncia o que implementa; cada script documentado executa.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'EOS', 'bin', 'eos.ts');

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const command = `npx tsx "${CLI}" ${args.map(a => `"${a}"`).join(' ')}`;
  try {
    const stdout = execFileSync(command, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: String(err.stdout || ''),
      stderr: String(err.stderr || ''),
      exitCode: typeof err.status === 'number' ? err.status : 1,
    };
  }
}

test('CA-04-01: help anuncia todos os comandos implementados', () => {
  const { stdout, exitCode } = runCli(['help']);
  assert.strictEqual(exitCode, 0);
  for (const cmd of ['mcp', 'audit', 'orchestrate', 'nist-assess', 'report', 'fix']) {
    assert.match(stdout, new RegExp(`\\b${cmd}\\b`), `help deve listar '${cmd}'`);
  }
});

test('CA-04-02: report falha fechado sem auditoria prévia', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor04-'));
  try {
    const { stdout, stderr, exitCode } = runCli(['report', root]);
    assert.notStrictEqual(exitCode, 0);
    assert.match(`${stdout}${stderr}`, /Nenhuma auditoria encontrada/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CA-04-02b: report reexibe auditoria existente sem reexecutar a esteira', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor04-'));
  try {
    fs.mkdirSync(path.join(root, '.eos'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.eos', 'auditoria.json'),
      JSON.stringify({
        audit_run_id: 'RUN-fixture-cor04',
        timestamp: '2026-10-09T00:00:00.000Z',
        target: { target_id: 'TGT-fixture' },
        coverage: { files_analyzed: 3, files_discovered: 3 },
        rule_results: [{ rule_id: 'R-1', status: 'PASS' }],
        security_claims: [],
        findings: [],
        overall_phase_status: 'GREEN',
      }),
    );
    const { stdout, exitCode } = runCli(['report', root]);
    assert.strictEqual(exitCode, 0);
    assert.match(stdout, /RUN-fixture-cor04/);
    assert.match(stdout, /GREEN/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CA-04-02d: report com auditoria BLOCKED espelha exit do audit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor04-'));
  try {
    fs.mkdirSync(path.join(root, '.eos'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.eos', 'auditoria.json'),
      JSON.stringify({
        audit_run_id: 'RUN-fixture-cor04-blocked',
        timestamp: '2026-10-09T00:00:00.000Z',
        target: { target_id: 'TGT-fixture' },
        coverage: { files_analyzed: 1, files_discovered: 1 },
        rule_results: [{ rule_id: 'R-1', status: 'PASS' }],
        security_claims: [],
        findings: [],
        overall_phase_status: 'BLOCKED',
      }),
    );
    const { stdout, exitCode } = runCli(['report', root]);
    assert.notStrictEqual(exitCode, 0);
    assert.match(stdout, /BLOCKED/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CA-04-02c: package.json sem script quebrado (graph removido, report presente)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.scripts.graph, undefined, 'script graph removido');
  assert.ok(pkg.scripts.report, 'script report presente');
  assert.ok(pkg.scripts.audit, 'script audit presente');
});
