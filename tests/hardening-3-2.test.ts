import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as assert from 'assert';
import * as crypto from 'crypto';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { FilesystemCollector } from '../EOS/core/collectors/filesystem-collector';
import { FileStructureFactProvider } from '../EOS/core/fact-providers/file-structure-fact-provider';
import { AuditApplicationService } from '../EOS/core/services/audit-application-service';

async function runHardeningTests() {
  console.log('==================================================');
  console.log('INICIANDO TESTES DE HARDENING DA FASE 3.2 (EOS v3.2)');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // --- I-FS-001: PATH CONTAINMENT ---
  await test('I-FS-001.1: Rejeição de root-evil e caminhos externos', () => {
    const root = path.normalize('/workspace/project');
    const evil = path.normalize('/workspace/project-evil');
    const relativeEscape = path.normalize('/workspace/project/../project-evil');
    const absExternal = path.normalize('/etc/passwd');

    assert.strictEqual(FilesystemCollector.isPathContained(root, root), true);
    assert.strictEqual(FilesystemCollector.isPathContained(root, path.join(root, 'src', 'app.ts')), true);
    assert.strictEqual(FilesystemCollector.isPathContained(root, evil), false);
    assert.strictEqual(FilesystemCollector.isPathContained(root, relativeEscape), false);
    assert.strictEqual(FilesystemCollector.isPathContained(root, absExternal), false);
  });

  await test('I-FS-001.2: FilesystemCollector ignora tentativas de Path Traversal no disco real', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-contain-'));
    const insideDir = path.join(tmpDir, 'inside');
    fs.mkdirSync(insideDir);
    fs.writeFileSync(path.join(insideDir, 'valid.txt'), 'valid');

    const target = TargetResolver.resolve(insideDir);
    const collector = new FilesystemCollector();
    const result = await collector.collect(target);

    for (const art of result.artifacts) {
      assert.ok(
        FilesystemCollector.isPathContained(target.root_path, art.absolute_path),
        `Artefato fora da raiz detectado: ${art.absolute_path}`
      );
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- I-FS-002: SYMLINK TERMINATION & CYCLE PREVENTION ---
  await test('I-FS-002: Symlinks cíclicos e symlinks de diretórios terminam sem exceção', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-symlink-'));
    const dirA = path.join(tmpDir, 'dirA');
    const dirB = path.join(tmpDir, 'dirB');
    fs.mkdirSync(dirA, { recursive: true });
    fs.mkdirSync(dirB, { recursive: true });

    fs.writeFileSync(path.join(dirA, 'fileA.txt'), 'file A');

    // Tentativa de criar symlinks (se o SO permitir)
    let symlinksCreated = false;
    try {
      // Symlink A -> B e B -> A (ciclo de diretório)
      fs.symlinkSync(dirB, path.join(dirA, 'linkToB'), 'junction');
      fs.symlinkSync(dirA, path.join(dirB, 'linkToA'), 'junction');

      // Symlink dir -> parent
      fs.symlinkSync(tmpDir, path.join(dirA, 'linkToParent'), 'junction');
      symlinksCreated = true;
    } catch {
      // Em ambientes sem privilégio de symlink no Windows, avança com teste simulado
    }

    const target = TargetResolver.resolve(tmpDir);
    const collector = new FilesystemCollector();

    // Deve ser concluído em milissegundos sem Stack Overflow
    const startTime = Date.now();
    const result = await collector.collect(target);
    const duration = Date.now() - startTime;

    assert.ok(duration < 5000, `Coleta demorou muito (${duration}ms), possível loop!`);

    if (symlinksCreated) {
      assert.ok(result.coverage.symlinks_discovered > 0);
      assert.ok(result.coverage.symlinks_skipped > 0);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- I-FS-003: BOUNDED MEMORY & LARGE FILE POLICY ---
  await test('I-FS-003: Arquivo grande excede MAX_FILE_SIZE e é marcado como SKIPPED no relatório', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-largefile-'));
    const largeFile = path.join(tmpDir, 'huge.bin');

    // Criar arquivo simulando 51MB (apenas escrevendo em blocos sem estourar heap do teste)
    const fd = fs.openSync(largeFile, 'w');
    const chunk = Buffer.alloc(1024 * 1024, 'a'); // 1MB chunk
    for (let i = 0; i < 51; i++) {
      fs.writeSync(fd, chunk);
    }
    fs.closeSync(fd);

    const target = TargetResolver.resolve(tmpDir);
    const collector = new FilesystemCollector();
    const result = await collector.collect(target);

    const largeArtifact = result.artifacts.find(a => a.relative_path === 'huge.bin');
    assert.ok(largeArtifact, 'Arquivo grande deve ser registrado nos artefatos');
    assert.strictEqual(largeArtifact?.status, 'IGNORED');
    assert.ok(largeArtifact?.error_message?.includes('excede o limite'));
    assert.strictEqual(result.coverage.files_skipped, 1);
    assert.strictEqual(result.coverage.files_analyzed, 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- I-FS-004: HASH INTEGRITY VIA STREAMING ---
  await test('I-FS-004: SHA-256 via Stream produz resultado exato e detecta alteração de 1 byte', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-stream-hash-'));
    const testFile = path.join(tmpDir, 'payload.bin');
    const buffer1 = Buffer.from('EOS-STREAMING-TEST-DATA-V3.2');
    fs.writeFileSync(testFile, buffer1);

    const expectedSha1 = crypto.createHash('sha256').update(buffer1).digest('hex');

    const target = TargetResolver.resolve(tmpDir);
    const collector = new FilesystemCollector();
    const res1 = await collector.collect(target);

    assert.strictEqual(res1.evidences[0].content_hash, expectedSha1);

    // Alterar 1 byte
    const buffer2 = Buffer.from('EOS-STREAMING-TEST-DATA-V3.3');
    fs.writeFileSync(testFile, buffer2);

    const expectedSha2 = crypto.createHash('sha256').update(buffer2).digest('hex');
    const res2 = await collector.collect(target);

    assert.strictEqual(res2.evidences[0].content_hash, expectedSha2);
    assert.notStrictEqual(res1.evidences[0].content_hash, res2.evidences[0].content_hash);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- I-FS-005: COVERAGE CONSERVATION ---
  await test('I-FS-005: Conservação Matemática da Cobertura (files_discovered = analyzed + skipped + errored + inaccessible)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-coverage-'));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, 'node_modules')); // Ignored dir

    fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'content a');
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.ts'), 'content b');
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.js'), 'dep');

    const target = TargetResolver.resolve(tmpDir);
    const collector = new FilesystemCollector();
    const result = await collector.collect(target);

    const c = result.coverage;
    const sumFiles = c.files_analyzed + c.files_skipped + c.files_errored + c.files_inaccessible;

    assert.strictEqual(
      c.files_discovered,
      sumFiles,
      `Conservação de Arquivos Violada! Discovered (${c.files_discovered}) != Sum (${sumFiles})`
    );

    assert.ok(c.directories_discovered > 0);
    assert.ok(c.directories_skipped > 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- I-FS-006: TARGET CANONICALIZATION ---
  await test('I-FS-006: Canonicalização de Target produz o mesmo target_id em casing equivalente', () => {
    const targetPath = path.resolve('.');
    const canonical = TargetResolver.canonicalizePath(targetPath);

    const target1 = TargetResolver.resolve(targetPath);
    const target2 = TargetResolver.resolve(canonical);

    assert.strictEqual(target1.target_id, target2.target_id);

    if (process.platform === 'win32') {
      const lowerDrivePath = targetPath[0].toLowerCase() + targetPath.slice(1);
      const upperDrivePath = targetPath[0].toUpperCase() + targetPath.slice(1);

      const tLower = TargetResolver.resolve(lowerDrivePath);
      const tUpper = TargetResolver.resolve(upperDrivePath);

      assert.strictEqual(tLower.target_id, tUpper.target_id, 'Drive letter casing gerou target_id divergente!');
    }
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 3.2: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch(err => {
  console.error('Erro nos testes de hardening:', err);
  process.exit(1);
});
