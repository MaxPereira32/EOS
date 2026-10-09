import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

// COR-09 (Fase C): verify-audit checa integridade dos manifestos e trava parecer↔SHA.

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

function writeManifest(dir: string, entries: Array<[string, string]>): void {
  const lines = ['# MANIFEST', '', '| Arquivo | SHA-256 |', '|---|---|'];
  for (const [file, sha] of entries) lines.push(`| ${file} | ${sha} |`);
  fs.writeFileSync(path.join(dir, 'MANIFEST.md'), lines.join('\n'));
}

function shaOf(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fixtureAud(root: string, audId: string, body: string): string {
  const evDir = path.join(root, 'docs', 'auditoria', 'auditorias', audId, 'achados', 'X', 'evidencias');
  fs.mkdirSync(evDir, { recursive: true });
  fs.writeFileSync(path.join(evDir, 'EVD.txt'), body);
  writeManifest(evDir, [['EVD.txt', shaOf(body)]]);
  return evDir;
}

test('CA-09-01: manifestos íntegros aprovam', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor09-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fixtureAud(root, 'AUD-2026-01-01-01', 'conteúdo íntegro');
  const { stdout, exitCode } = runCli(['verify-audit', 'AUD-2026-01-01-01', root]);
  assert.strictEqual(exitCode, 0);
  assert.match(stdout, /VERIFICAÇÃO APROVADA/);
});

test('CA-09-02: artefato adulterado ou ausente reprova', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor09-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evDir = fixtureAud(root, 'AUD-2026-01-01-02', 'original');
  fs.writeFileSync(path.join(evDir, 'EVD.txt'), 'ADULTERADO');
  const tampered = runCli(['verify-audit', 'AUD-2026-01-01-02', root]);
  assert.notStrictEqual(tampered.exitCode, 0);
  assert.match(`${tampered.stdout}${tampered.stderr}`, /HASH DIVERGENTE/);

  fs.rmSync(path.join(evDir, 'EVD.txt'));
  const missing = runCli(['verify-audit', 'AUD-2026-01-01-02', root]);
  assert.notStrictEqual(missing.exitCode, 0);
  assert.match(`${missing.stdout}${missing.stderr}`, /AUSENTE/);
});

test('CA-09-03: mudança pós---since exige nova rodada', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor09-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evDir = fixtureAud(root, 'AUD-2026-01-01-03', 'v1');
  execFileSync('git', ['init'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', 'base'], { cwd: root });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

  const clean = runCli(['verify-audit', 'AUD-2026-01-01-03', root, '--since', base]);
  assert.strictEqual(clean.exitCode, 0, clean.stdout + clean.stderr);

  fs.writeFileSync(path.join(evDir, 'EVD.txt'), 'v1');
  fs.writeFileSync(path.join(evDir, 'parecer.md'), '# parecer posterior');
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', 'pos'], { cwd: root });
  const dirty = runCli(['verify-audit', 'AUD-2026-01-01-03', root, '--since', base]);
  assert.notStrictEqual(dirty.exitCode, 0);
  assert.match(`${dirty.stdout}${dirty.stderr}`, /nova rodada/);
});

test('CA-09-04: auditoria inexistente falha fechado', () => {
  const { exitCode } = runCli(['verify-audit', 'AUD-1900-01-01-99', REPO_ROOT]);
  assert.notStrictEqual(exitCode, 0);
});

test('CA-09-05: manifestos sem entradas verificáveis não aprovam em silêncio', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-cor09-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evDir = path.join(root, 'docs', 'auditoria', 'auditorias', 'AUD-2026-01-01-05', 'achados', 'X', 'evidencias');
  fs.mkdirSync(evDir, { recursive: true });
  fs.writeFileSync(path.join(evDir, 'MANIFEST.md'), '# MANIFEST\n\n| Arquivo | SHA-256 |\n|---|---|\n');
  const { stdout, exitCode } = runCli(['verify-audit', 'AUD-2026-01-01-05', root]);
  assert.notStrictEqual(exitCode, 0);
  assert.match(`${stdout}`, /NENHUM_ARTEFATO_VERIFICAVEL/);
});
