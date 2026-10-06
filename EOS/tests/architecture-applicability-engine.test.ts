import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArchitectureApplicabilityEngine } from '../core/engines/architecture-applicability-engine';

function withTempProject(run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-arch-applicability-'));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2), 'utf8');
}

describe('ArchitectureApplicabilityEngine', () => {
  it('não exige domínio de frontend simples sem backend/persistência', () => {
    withTempProject(root => {
      writeJson(root, 'package.json', {
        name: 'landing',
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      });
      fs.mkdirSync(path.join(root, 'src', 'components'), { recursive: true });

      const assessment = new ArchitectureApplicabilityEngine().assess(root);

      assert.strictEqual(assessment.inferred_profile, 'STATIC_FRONTEND');
      assert.strictEqual(assessment.domain_policy, 'NOT_APPLICABLE');
      assert.match(assessment.recommendation, /componentes\/features/i);
    });
  });

  it('recomenda monólito modular para aplicação de negócio com backend, persistência e múltiplos módulos', () => {
    withTempProject(root => {
      writeJson(root, 'package.json', {
        name: 'business-app',
        dependencies: {
          fastify: '^5.0.0',
          'drizzle-orm': '^0.44.0',
          pg: '^8.0.0',
        },
      });
      for (const moduleName of ['estoque', 'usuarios', 'relatorios']) {
        fs.mkdirSync(path.join(root, 'backend', 'src', 'modules', moduleName), { recursive: true });
      }

      const assessment = new ArchitectureApplicabilityEngine().assess(root);

      assert.strictEqual(assessment.inferred_profile, 'MODULAR_MONOLITH');
      assert.strictEqual(assessment.domain_policy, 'OPTIONAL');
      assert.ok(assessment.confidence >= 0.8);
      assert.match(assessment.recommendation, /monólito modular/i);
    });
  });

  it('torna domínio obrigatório quando Clean Architecture é declarada explicitamente', () => {
    withTempProject(root => {
      fs.writeFileSync(
        path.join(root, 'eos.risk.yml'),
        [
          'architecture:',
          '  profile: clean-architecture',
          '  domain_directory: src/core/domain',
          '',
        ].join('\n'),
        'utf8',
      );

      const assessment = new ArchitectureApplicabilityEngine().assess(root);

      assert.strictEqual(assessment.declared_profile, 'CLEAN_ARCHITECTURE');
      assert.strictEqual(assessment.effective_profile, 'CLEAN_ARCHITECTURE');
      assert.strictEqual(assessment.domain_policy, 'REQUIRED');
      assert.strictEqual(assessment.domain_directory, 'src/core/domain');
      assert.strictEqual(assessment.confidence, 1.0);
    });
  });

  it('domain_required false prevalece sobre o perfil declarado', () => {
    withTempProject(root => {
      fs.writeFileSync(
        path.join(root, 'eos.risk.yml'),
        [
          'architecture:',
          '  profile: clean-architecture',
          '  domain_required: false',
          '',
        ].join('\n'),
        'utf8',
      );

      const assessment = new ArchitectureApplicabilityEngine().assess(root);
      assert.strictEqual(assessment.domain_policy, 'NOT_APPLICABLE');
    });
  });
});
