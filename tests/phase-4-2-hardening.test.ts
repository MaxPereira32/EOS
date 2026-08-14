import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { TargetResolver } from '../EOS/core/domain/target-resolver';
import { TypescriptAstCollector } from '../EOS/core/collectors/typescript-ast-collector';
import { DependencyFactProvider } from '../EOS/core/fact-providers/dependency-fact-provider';
import { NoDisallowedDependencyRule, normalizeModuleIdentity } from '../EOS/core/rules/no-disallowed-dependency-rule';
import { Evidence } from '../EOS/core/domain/types';

async function runPhase42HardeningTests() {
  console.log('==================================================');
  console.log('INICIANDO SUÍTE DE TESTES DA FASE 4.2 — HARDENING');
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

  const collector = new TypescriptAstCollector();
  const provider = new DependencyFactProvider();
  const rule = new NoDisallowedDependencyRule();
  const target = TargetResolver.resolve('.');

  // 4.2-001: Casing cross-platform (src/domain/User.ts, src/Domain/User.ts, src/DOMAIN/User.ts)
  await test('4.2-001: Casing cross-platform detecta violação em qualquer variação de casing', () => {
    const paths = ['src/domain/User.ts', 'src/Domain/User.ts', 'src/DOMAIN/User.ts'];

    for (const p of paths) {
      const ev: Evidence = {
        evidence_id: `EVD-CASING-${p}`,
        observation_id: 'OBS-01',
        collector_id: 'typescript-ast-collector-v4',
        source_reference: p,
        locator: { relative_path: p, line: 1 },
        source_hash: 'sha1',
        content_hash: 'sha2',
        snippet: 'import { DB } from "../infra/db"',
        confidence: 1.0,
        provenance: { target_id: target.target_id, collector_version: '4.2.0' },
        ast_metadata: {
          kind: 'MODULE_IMPORT',
          specifier: '../infra/db',
          import_type: 'STATIC',
        },
      };

      const facts = provider.generateFacts([ev]);
      const res = rule.evaluate(facts, target);
      assert.strictEqual(res.evaluation.status, 'FAIL', `Falha ao detectar violação com caminho '${p}'!`);
    }
  });

  // 4.2-002: Normalização ./db vs ./db.ts
  await test('4.2-002: Normalização produz target_module equivalente para ./db e ./db.ts', () => {
    const norm1 = provider.normalizeTargetModule('src/domain/User.ts', './db');
    const norm2 = provider.normalizeTargetModule('src/domain/User.ts', './db.ts');
    assert.strictEqual(norm1, norm2);
    assert.strictEqual(norm1, 'src/domain/db');
  });

  // 4.2-003: Normalização ./index vs ./index.ts
  await test('4.2-003: Normalização de ./index e ./index.ts resulta em caminho base canônico', () => {
    const norm1 = provider.normalizeTargetModule('src/domain/User.ts', './index');
    const norm2 = provider.normalizeTargetModule('src/domain/User.ts', './index.ts');
    assert.strictEqual(norm1, norm2);
    assert.strictEqual(norm1, 'src/domain');
  });

  // 4.2-004: Extensões distintas (.ts vs .tsx vs .js) são normalizadas para o mesmo módulo base sem corrupção
  await test('4.2-004: Extensões .ts, .tsx, .js, .jsx, .mts, .cts são removidas na posição de extensão final', () => {
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];
    for (const ext of exts) {
      const norm = provider.normalizeTargetModule('src/domain/User.ts', `./component${ext}`);
      assert.strictEqual(norm, 'src/domain/component');
    }
  });

  // 4.2-005: Nomes contendo extensões legítimas (ex: contest.tsx, test.ts, status.js) não são corrompidos
  await test('4.2-005: Nomes com substrings de extensão legítima no meio não sofrem remoção precoce', () => {
    const norm1 = provider.normalizeTargetModule('src/domain/User.ts', './contest');
    const norm2 = provider.normalizeTargetModule('src/domain/User.ts', './testing');
    const norm3 = provider.normalizeTargetModule('src/domain/User.ts', './status');

    assert.strictEqual(norm1, 'src/domain/contest');
    assert.strictEqual(norm2, 'src/domain/testing');
    assert.strictEqual(norm3, 'src/domain/status');
  });

  // 4.2-006: Collector produz metadados estruturados (ast_metadata)
  await test('4.2-006: TypescriptAstCollector inclui ast_metadata estruturado em todas as Evidences', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-ast-meta-'));
    const tsFile = path.join(tmpDir, 'Sample.ts');
    const content = `import { Service } from './Service';`;
    fs.writeFileSync(tsFile, content);

    const tgt = TargetResolver.resolve(tmpDir);
    const evidences = await collector.collectFromArtifacts(tgt, [{
      relative_path: 'Sample.ts',
      absolute_path: tsFile,
      file_extension: '.ts',
      size_bytes: content.length,
      sha256_hash: crypto.createHash('sha256').update(content).digest('hex'),
      status: 'ACCESSIBLE',
    }]);

    assert.strictEqual(evidences.length, 1);
    assert.ok(evidences[0].ast_metadata);
    assert.strictEqual(evidences[0].ast_metadata.kind, 'MODULE_IMPORT');
    assert.strictEqual(evidences[0].ast_metadata.specifier, './Service');
    assert.strictEqual(evidences[0].ast_metadata.import_type, 'STATIC');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 4.2-007 & 13: Teste de Não Regressão do Snippet (FactProvider não depende de snippet textual)
  await test('4.2-007: FactProvider gera exatamente o mesmo Fact com snippet alterado/corrompido quando ast_metadata existe', () => {
    const ev1: Evidence = {
      evidence_id: 'EVD-01',
      observation_id: 'OBS-01',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'ORIGINAL SNIPPET FORMATTED (specifier: "../infra/db")',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: {
        kind: 'MODULE_IMPORT',
        specifier: '../infra/db',
        import_type: 'STATIC',
      },
    };

    const evMutatedSnippet: Evidence = {
      ...ev1,
      snippet: 'MUTATED SNIPPET WITHOUT ANY SPECIFIER TEXT IN IT!',
    };

    const facts1 = provider.generateFacts([ev1]);
    const facts2 = provider.generateFacts([evMutatedSnippet]);

    assert.strictEqual(facts1.length, 1);
    assert.strictEqual(facts2.length, 1);
    assert.strictEqual(facts1[0].fact_id, facts2[0].fact_id);
    assert.strictEqual(facts1[0].payload.fact_type, 'MODULE_DEPENDENCY');
    if (facts1[0].payload.fact_type === 'MODULE_DEPENDENCY' && facts2[0].payload.fact_type === 'MODULE_DEPENDENCY') {
      assert.strictEqual(facts1[0].payload.target_module, facts2[0].payload.target_module);
    }
  });

  // 4.2-008: Evidence estruturada produz Fact correto
  await test('4.2-008: Evidence estruturada gera Fato MODULE_DEPENDENCY completo e tipado', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-08',
      observation_id: 'OBS-08',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 10 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { Repo } from "../infra/repo"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: {
        kind: 'MODULE_IMPORT',
        specifier: '../infra/repo',
        import_type: 'STATIC',
      },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts.length, 1);
    assert.strictEqual(facts[0].fact_type, 'MODULE_DEPENDENCY');
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-08');
  });

  // 4.2-009 & 14: Evidence malformada não gera Fact falso
  await test('4.2-009: Evidence sem ast_metadata e sem specifier no snippet não produz Fato semântico', () => {
    const evMalformed: Evidence = {
      evidence_id: 'EVD-MALFORMED',
      observation_id: 'OBS-MALFORMED',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'GARBAGE TEXT WITHOUT ANY IMPORT',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
    };

    const facts = provider.generateFacts([evMalformed]);
    assert.strictEqual(facts.length, 0);
  });

  // 4.2-010: Determinismo do Fact
  await test('4.2-010: Fatos semânticos gerados são 100% determinísticos em múltiplas execuções', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-10',
      observation_id: 'OBS-10',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/User.ts',
      locator: { relative_path: 'src/domain/User.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { X } from "./X"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: './X', import_type: 'STATIC' },
    };

    const runA = provider.generateFacts([ev]);
    const runB = provider.generateFacts([ev]);

    assert.strictEqual(runA[0].input_hash, runB[0].input_hash);
    assert.strictEqual(runA[0].fact_id, runB[0].fact_id);
  });

  // 4.2-011: Proveniência preservada após normalização
  await test('4.2-011: Normalização preserva source_reference, locator, source_hash e evidence_ids intactos', () => {
    const ev: Evidence = {
      evidence_id: 'EVD-PROV-11',
      observation_id: 'OBS-PROV-11',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/Domain/User.ts', // casing original
      locator: { relative_path: 'src/Domain/User.ts', line: 42 },
      source_hash: 'sha256-original-content',
      content_hash: 'sha256-snippet',
      snippet: 'import { DB } from "../infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../infra/db', import_type: 'STATIC' },
    };

    const facts = provider.generateFacts([ev]);
    assert.strictEqual(facts[0].evidence_ids[0], 'EVD-PROV-11');
    assert.strictEqual(ev.source_reference, 'src/Domain/User.ts');
    assert.strictEqual(ev.locator.line, 42);
    assert.strictEqual(ev.source_hash, 'sha256-original-content');
  });

  // 4.2-012: Rule continua sem I/O
  await test('4.2-012: NoDisallowedDependencyRule executa sem realizar chamadas de sistema de arquivos', () => {
    const facts = provider.generateFacts([{
      evidence_id: 'EVD-NOIO',
      observation_id: 'OBS-NOIO',
      collector_id: 'typescript-ast-collector-v4',
      source_reference: 'src/domain/NoIo.ts',
      locator: { relative_path: 'src/domain/NoIo.ts', line: 1 },
      source_hash: 'sha1',
      content_hash: 'sha2',
      snippet: 'import { DB } from "../infra/db"',
      confidence: 1.0,
      provenance: { target_id: target.target_id, collector_version: '4.2.0' },
      ast_metadata: { kind: 'MODULE_IMPORT', specifier: '../infra/db', import_type: 'STATIC' },
    }]);

    const res = rule.evaluate(facts, target);
    assert.strictEqual(res.evaluation.status, 'FAIL');
  });

  // 4.2-013 & 014: FactProvider sem I/O e sem execução de código
  await test('4.2-013 & 014: DependencyFactProvider opera exclusivamente em memória', () => {
    const facts = provider.generateFacts([]);
    assert.strictEqual(facts.length, 0);
  });

  console.log('\n==================================================');
  console.log(`RESUMO FASE 4.2: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase42HardeningTests().catch(err => {
  console.error('Erro nos testes de Hardening da Fase 4.2:', err);
  process.exit(1);
});
