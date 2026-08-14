import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { FilesystemCollector } from '../EOS/core/collectors/filesystem-collector';
import { FileStructureFactProvider } from '../EOS/core/fact-providers/file-structure-fact-provider';
import { MandatoryDirectoryRule } from '../EOS/core/rules/mandatory-directory-rule';

async function runVerticalSliceTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE DE TESTES DA VERTICAL SLICE 1.0 (EOS v3.0)');
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

  // 1. Target Inexistente
  await test('1. Target inexistente lança exceção', () => {
    assert.throws(() => {
      TargetResolver.resolve('./diretorio-que-nao-existe-12345');
    }, /AuditTarget Error/);
  });

  // 2. Target que é arquivo
  await test('2. Target que é arquivo lança exceção', () => {
    const tmpFile = path.join(os.tmpdir(), 'eos-test-file.txt');
    fs.writeFileSync(tmpFile, 'test');
    assert.throws(() => {
      TargetResolver.resolve(tmpFile);
    }, /não é um diretório/);
    fs.unlinkSync(tmpFile);
  });

  // 3. Target válido com canonicalização
  await test('3. Target válido retorna AuditTarget com path absoluto', () => {
    const target = TargetResolver.resolve('.');
    assert.ok(path.isAbsolute(target.root_path));
    assert.ok(target.target_id.startsWith('TGT-'));
  });

  // 4 & 5. Path Containment & Escape Prevention
  await test('4 & 5. FilesystemCollector não escapa do root_path', async () => {
    const collector = new FilesystemCollector();
    const target = TargetResolver.resolve('.');
    const result = await collector.collect(target);
    
    for (const art of result.artifacts) {
      assert.ok(art.absolute_path.startsWith(target.root_path), `Path escapou: ${art.absolute_path}`);
      assert.ok(!art.relative_path.startsWith('..'), `Relative path inválido: ${art.relative_path}`);
    }
  });

  // 6. SHA-256 Real
  await test('6. FilesystemCollector calcula SHA-256 real', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-test-sha-'));
    const tmpFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(tmpFile, 'hello eos world');

    const collector = new FilesystemCollector();
    const target = TargetResolver.resolve(tmpDir);
    const result = await collector.collect(target);

    const expectedSha = crypto.createHash('sha256').update('hello eos world').digest('hex');
    assert.strictEqual(result.evidences[0].content_hash, expectedSha);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 8. Fact sem Evidence & 13. INSUFFICIENT_EVIDENCE
  await test('8 & 13. FactProvider trata ausência de evidências como INSUFFICIENT_EVIDENCE', () => {
    const provider = new FileStructureFactProvider();
    const facts = provider.generateFacts([], 'src/domain');
    if (facts[0].payload.fact_type === 'FILE_STRUCTURE') {
      assert.strictEqual(facts[0].payload.status, 'INSUFFICIENT_EVIDENCE');
    }

    const rule = new MandatoryDirectoryRule();
    const target = TargetResolver.resolve('.');
    const evalRes = rule.evaluate(facts, target);
    assert.strictEqual(evalRes.evaluation.status, 'INSUFFICIENT_EVIDENCE');
  });

  // 9. input_hash é determinístico
  await test('9. input_hash é determinístico', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-test-det-'));
    fs.writeFileSync(path.join(tmpDir, 'dummy.txt'), 'data');

    const collector = new FilesystemCollector();
    const provider = new FileStructureFactProvider();
    const target = TargetResolver.resolve(tmpDir);

    const res1 = await collector.collect(target);
    const facts1 = provider.generateFacts(res1.evidences, 'src/domain');

    const res2 = await collector.collect(target);
    const facts2 = provider.generateFacts(res2.evidences, 'src/domain');

    assert.strictEqual(facts1[0].input_hash, facts2[0].input_hash);
    assert.strictEqual(facts1[0].fact_id, facts2[0].fact_id);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 10. Alteração de arquivo altera SHA-256 e input_hash
  await test('10. Alteração de arquivo altera SHA-256 e input_hash', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-test-diff-'));
    const filePath = path.join(tmpDir, 'file.txt');
    fs.writeFileSync(filePath, 'version 1');

    const collector = new FilesystemCollector();
    const provider = new FileStructureFactProvider();
    const target = TargetResolver.resolve(tmpDir);

    const res1 = await collector.collect(target);
    const facts1 = provider.generateFacts(res1.evidences, 'src/domain');

    fs.writeFileSync(filePath, 'version 2 (modified)');

    const res2 = await collector.collect(target);
    const facts2 = provider.generateFacts(res2.evidences, 'src/domain');

    assert.notStrictEqual(res1.evidences[0].content_hash, res2.evidences[0].content_hash);
    assert.notStrictEqual(facts1[0].input_hash, facts2[0].input_hash);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 11, 12, 16. Teste de Integração Real (PASS / FAIL)
  await test('11, 12, 16. Teste de Integração Real: PASS quando src/domain existe, FAIL quando removido', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-integration-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const domainDir = path.join(tmpDir, 'src', 'domain');
    fs.mkdirSync(domainDir, { recursive: true });
    fs.writeFileSync(path.join(domainDir, 'Entity.ts'), '// entity');

    const collector = new FilesystemCollector();
    const provider = new FileStructureFactProvider();
    const rule = new MandatoryDirectoryRule();

    // Cenario 1: Diretório Existe -> PASS
    let target = TargetResolver.resolve(tmpDir);
    let colRes = await collector.collect(target);
    let facts = provider.generateFacts(colRes.evidences, 'src/domain');
    let evalRes = rule.evaluate(facts, target);

    assert.strictEqual(evalRes.evaluation.status, 'PASS');
    assert.strictEqual(evalRes.finding, undefined);

    // Cenario 2: Diretório Removido -> FAIL + Finding
    fs.rmSync(domainDir, { recursive: true, force: true });

    colRes = await collector.collect(target);
    facts = provider.generateFacts(colRes.evidences, 'src/domain');
    evalRes = rule.evaluate(facts, target);

    assert.strictEqual(evalRes.evaluation.status, 'FAIL');
    assert.ok(evalRes.finding);
    assert.strictEqual(evalRes.finding.rule_id, 'ARCH-RULE-001-MANDATORY-DOMAIN-DIR');
    assert.strictEqual(evalRes.finding.severity, 'HIGH');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  console.log('\n==================================================');
  console.log(`RESUMO: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerticalSliceTests().catch(err => {
  console.error('Erro na suíte de testes:', err);
  process.exit(1);
});
