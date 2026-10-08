import { test } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditApplicationService } from '../core/services/audit-application-service';

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('EOS-GOV-011: execucoes sucessivas preservam historico em auditorias/<run_id>', async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-archive-target-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-archive-out-'));
  try {
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'archive-target', version: '1.0.0', scripts: {} }),
    );

    const service = new AuditApplicationService();
    const first = await service.executeAudit(target, outDir);

    const firstArchiveJson = path.join(outDir, 'auditorias', first.audit_run_id, 'auditoria.json');
    const firstArchiveMd = path.join(outDir, 'auditorias', first.audit_run_id, 'acf-auditoria.md');
    assert.ok(fs.existsSync(firstArchiveJson), 'arquivo arquivado da execucao 1 deve existir');
    assert.ok(fs.existsSync(firstArchiveMd), 'relatorio markdown arquivado da execucao 1 deve existir');
    const firstHash = hashFile(firstArchiveJson);

    await new Promise(resolve => setTimeout(resolve, 5));
    const second = await service.executeAudit(target, outDir);

    assert.notStrictEqual(second.audit_run_id, first.audit_run_id, 'execucoes devem ter run_id distintos');
    const secondArchiveJson = path.join(outDir, 'auditorias', second.audit_run_id, 'auditoria.json');
    assert.ok(fs.existsSync(secondArchiveJson), 'arquivo arquivado da execucao 2 deve existir');
    assert.strictEqual(hashFile(firstArchiveJson), firstHash, 'execucao 2 nao pode alterar o arquivo da execucao 1');

    assert.ok(fs.existsSync(path.join(outDir, 'auditoria.json')), 'caminho canonico auditoria.json deve continuar existindo');
    assert.ok(fs.existsSync(path.join(outDir, 'acf-auditoria.md')), 'caminho canonico acf-auditoria.md deve continuar existindo');
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
