import { test } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';
import { AuditRegistryService, AuditRunIdentification } from '../core/services/audit-registry-service';

function makeTarget(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'registry-target', version: '1.0.0', scripts: {} }),
  );
  return dir;
}

async function cleanup(...roots: string[]): Promise<void> {
  const retryableCodes = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY']);
  for (const root of roots) {
    const deadline = Date.now() + 10_000;
    while (true) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!code || !retryableCodes.has(code) || Date.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
}

function readIdentification(targetDir: string, runId: string): AuditRunIdentification {
  return JSON.parse(
    fs.readFileSync(path.join(targetDir, '.eos', 'auditorias', runId, 'identificacao.json'), 'utf8'),
  );
}

test('EOS-GOV-012: artefatos ancorados ao projeto auditado, nunca ao cwd', async () => {
  const targetA = makeTarget('eos-anchor-a-');
  const targetB = makeTarget('eos-anchor-b-');
  try {
    const service = new AuditApplicationService();
    const runA = await service.executeAudit(targetA);
    const runB = await service.executeAudit(targetB);

    assert.ok(fs.existsSync(path.join(targetA, '.eos', 'auditoria.json')), 'canonico no alvo A');
    assert.ok(fs.existsSync(path.join(targetB, '.eos', 'auditoria.json')), 'canonico no alvo B');
    assert.ok(fs.existsSync(path.join(targetA, '.eos', 'auditorias', runA.audit_run_id)), 'arquivo no alvo A');
    assert.ok(fs.existsSync(path.join(targetB, '.eos', 'auditorias', runB.audit_run_id)), 'arquivo no alvo B');
    assert.ok(!fs.existsSync(path.join(targetB, '.eos', 'auditorias', runA.audit_run_id)), 'sem mistura entre projetos');
    assert.ok(!fs.existsSync(path.join(process.cwd(), '.eos', 'auditorias', runA.audit_run_id)), 'cwd nao recebe o alvo A');
  } finally {
    await cleanup(targetA, targetB);
  }
});

test('EOS-GOV-013: identificacao.json com projeto estavel, interface e hash do artefato', async () => {
  const target = makeTarget('eos-ident-');
  try {
    const service = new AuditApplicationService();
    const report = await service.executeAudit(target, undefined, { interface: 'CLI' });
    const identification = readIdentification(target, report.audit_run_id);

    assert.strictEqual(identification.audit_run_id, report.audit_run_id);
    assert.strictEqual(identification.interface, 'CLI');
    assert.strictEqual(identification.executor, 'EOS AuditApplicationService');
    assert.strictEqual(identification.eos_version, '2.2.0');
    assert.strictEqual(identification.status, report.overall_phase_status);
    assert.strictEqual(identification.project.project_id, AuditRegistryService.computeProjectId(target));
    assert.strictEqual(identification.project.target_id, report.target.target_id);
    assert.strictEqual(identification.project.root_path, report.target.root_path);

    const archived = fs.readFileSync(path.join(target, '.eos', 'auditorias', report.audit_run_id, 'auditoria.json'));
    const archivedHash = crypto.createHash('sha256').update(archived).digest('hex');
    assert.strictEqual(identification.artifacts.auditoria_json_sha256, archivedHash);
  } finally {
    await cleanup(target);
  }
});

test('EOS-GOV-013: historico consultavel le registros persistidos e indice derivado consistente', async () => {
  const target = makeTarget('eos-history-');
  try {
    const service = new AuditApplicationService();
    const first = await service.executeAudit(target);
    const second = await service.executeAudit(target);
    const eosDir = path.join(target, '.eos');

    const listed = AuditRegistryService.listAudits(eosDir);
    assert.strictEqual(listed.length, 2);
    assert.deepStrictEqual(
      listed.map(run => run.audit_run_id).sort(),
      [first.audit_run_id, second.audit_run_id].sort(),
    );

    const index = JSON.parse(fs.readFileSync(path.join(eosDir, 'indice-auditorias.json'), 'utf8'));
    assert.strictEqual(index.runs.length, 2);
    assert.ok(index.runs.some((run: { audit_run_id: string }) => run.audit_run_id === first.audit_run_id));
  } finally {
    await cleanup(target);
  }
});

test('EOS-GOV-014: reocorrencia vinculada ao historico e evidencias proprias por execucao', async () => {
  const target = makeTarget('eos-recurrence-');
  try {
    const service = new AuditApplicationService();
    const first = await service.executeAudit(target);
    const second = await service.executeAudit(target);
    const identificationFirst = readIdentification(target, first.audit_run_id);
    const identificationSecond = readIdentification(target, second.audit_run_id);

    const occurrence = identificationSecond.gate_occurrences.find(
      item => item.reference === 'EOS-GOVERNANCE-001',
    );
    assert.ok(occurrence, 'gate persistente deve constar na execucao 2');
    assert.ok(
      occurrence.previous_run_ids.includes(first.audit_run_id),
      'reocorrencia deve vincular a execucao 1',
    );

    assert.notStrictEqual(
      identificationSecond.artifacts.auditoria_json_sha256,
      identificationFirst.artifacts.auditoria_json_sha256,
      'execucao 2 nao pode reutilizar artefato da execucao 1 como proprio',
    );
  } finally {
    await cleanup(target);
  }
});

test('EOS-GOV-012: falha de armazenamento rejeita sem sucesso artificial', async () => {
  const target = makeTarget('eos-storefail-');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-storefail-out-'));
  try {
    fs.writeFileSync(path.join(outDir, 'auditorias'), 'bloqueio proposital do arquivamento');
    const service = new AuditApplicationService();
    await assert.rejects(() => service.executeAudit(target, outDir));
    assert.ok(
      !fs.existsSync(path.join(outDir, 'auditorias', 'identificacao.json')),
      'nenhuma identificacao pode ser produzida na falha',
    );
  } finally {
    await cleanup(target, outDir);
  }
});

test('EOS-GOV-013: execucoes simultaneas nao colidem nem se sobrescrevem', async () => {
  const target = makeTarget('eos-concurrent-');
  try {
    const service = new AuditApplicationService();
    const [first, second] = await Promise.all([
      service.executeAudit(target),
      service.executeAudit(target),
    ]);

    assert.notStrictEqual(first.audit_run_id, second.audit_run_id);
    for (const runId of [first.audit_run_id, second.audit_run_id]) {
      assert.ok(
        fs.existsSync(path.join(target, '.eos', 'auditorias', runId, 'auditoria.json')),
        `arquivo da execucao ${runId} deve existir`,
      );
      assert.ok(
        fs.existsSync(path.join(target, '.eos', 'auditorias', runId, 'identificacao.json')),
        `identificacao da execucao ${runId} deve existir`,
      );
    }
    assert.strictEqual(AuditRegistryService.listAudits(path.join(target, '.eos')).length, 2);
  } finally {
    await cleanup(target);
  }
});
