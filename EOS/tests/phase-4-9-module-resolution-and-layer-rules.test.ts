import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { SemanticModuleResolver, TsConfigPathsConfig } from '../core/resolvers/semantic-module-resolver';
import { NoDisallowedDependencyRule } from '../core/rules/no-disallowed-dependency-rule';
import { Fact, AuditTarget } from '../core/domain/types';

describe('EOS Phase 4.9 — Module Resolution & Architecture Layer Rules Suite', () => {
  const resolver = new SemanticModuleResolver();

  it('TEST-RESOLVE-01: alias válido em tsconfig -> resolve para arquivo correto', () => {
    const config: TsConfigPathsConfig = {
      baseUrl: '.',
      paths: {
        '@/*': ['src/*'],
      },
      knownFiles: ['src/services/auth.ts', 'src/domain/user.ts'],
    };

    const res = resolver.resolveDetailed('src/presentation/controller.ts', '@/services/auth', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.canonical_module, 'src/services/auth');
    assert.strictEqual(res.strategy, 'PATH_ALIAS');
  });

  it('TEST-RESOLVE-02: barrel export -> segue destino sem ambiguidade', () => {
    const config: TsConfigPathsConfig = {
      knownFiles: ['src/domain/models/index.ts', 'src/domain/models/user.ts'],
    };

    const res = resolver.resolveDetailed('src/application/usecase.ts', '../domain/models', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.canonical_module, 'src/domain/models');
  });

  it('TEST-RESOLVE-03: type-only ou static import -> resolução determinística', () => {
    const config: TsConfigPathsConfig = {
      knownFiles: ['src/domain/ports/user-repository.ts'],
    };

    const res = resolver.resolveDetailed('src/domain/usecase.ts', './ports/user-repository', config);
    assert.strictEqual(res.kind, 'INTERNAL');
    assert.strictEqual(res.canonical_module, 'src/domain/ports/user-repository');
  });

  it('TEST-RESOLVE-04: import inexistente -> UNRESOLVED -> não PASS', () => {
    const config: TsConfigPathsConfig = {
      knownFiles: ['src/domain/user.ts'],
    };

    const res = resolver.resolveDetailed('src/domain/user.ts', './non-existent-module', config);
    assert.strictEqual(res.kind, 'UNRESOLVED');
    assert.strictEqual(res.canonical_module, null);
  });

  it('TEST-RESOLVE-05: dois destinos possíveis -> AMBIGUOUS -> não escolher heurística', () => {
    const config: TsConfigPathsConfig = {
      knownFiles: ['src/utils/date.ts', 'src/utils/date.tsx'],
    };

    const res = resolver.resolveDetailed('src/domain/user.ts', '../utils/date', config);
    assert.strictEqual(res.kind, 'AMBIGUOUS');
    assert.strictEqual(res.candidates.length, 2);
  });

  it('TEST-RESOLVE-06: Domain -> Infrastructure real -> VIOLATION (FAIL)', () => {
    const rule = new NoDisallowedDependencyRule('src/domain');
    const target: AuditTarget = {
      target_id: 'TGT-TEST',
      root_path: '.',
      repository: null,
      commit_hash: null,
      branch: null,
      metadata: {},
    };

    const facts: Fact[] = [{
      fact_id: 'FCT-DEP-TEST-01',
      schema_version: '1.0.0',
      fact_type: 'MODULE_DEPENDENCY',
      provider_id: 'dependency-fact-provider',
      provider_version: '5.1.0',
      evidence_ids: ['EVD-01'],
      input_hash: 'hash01',
      semantic_hash: 'sem01',
      lifecycle_status: 'VALID',
      payload: {
        fact_type: 'MODULE_DEPENDENCY',
        source_module: 'src/domain/order-service.ts',
        target_module: 'src/infrastructure/database/postgres.ts',
        import_type: 'STATIC',
        resolution_kind: 'INTERNAL',
        resolution_strategy: 'RELATIVE',
      },
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
    }];

    const evaluation = rule.evaluate(facts, target);
    assert.strictEqual(evaluation.evaluation.status, 'FAIL');
    assert.strictEqual(evaluation.findings.length, 1);
    assert.strictEqual(evaluation.findings[0].severity, 'HIGH');
  });

  it('TEST-RESOLVE-07: Domain -> Port -> PASS', () => {
    const rule = new NoDisallowedDependencyRule('src/domain');
    const target: AuditTarget = {
      target_id: 'TGT-TEST',
      root_path: '.',
      repository: null,
      commit_hash: null,
      branch: null,
      metadata: {},
    };

    const facts: Fact[] = [{
      fact_id: 'FCT-DEP-TEST-02',
      schema_version: '1.0.0',
      fact_type: 'MODULE_DEPENDENCY',
      provider_id: 'dependency-fact-provider',
      provider_version: '5.1.0',
      evidence_ids: ['EVD-02'],
      input_hash: 'hash02',
      semantic_hash: 'sem02',
      lifecycle_status: 'VALID',
      payload: {
        fact_type: 'MODULE_DEPENDENCY',
        source_module: 'src/domain/order-service.ts',
        target_module: 'src/domain/ports/order-repository.ts',
        import_type: 'STATIC',
        resolution_kind: 'INTERNAL',
        resolution_strategy: 'RELATIVE',
      },
      composite_confidence: 1.0,
      created_at: new Date().toISOString(),
    }];

    const evaluation = rule.evaluate(facts, target);
    assert.strictEqual(evaluation.evaluation.status, 'PASS');
    assert.strictEqual(evaluation.findings.length, 0);
  });

  it('TEST-RESOLVE-08: External package declared -> classificado como EXTERNAL', () => {
    const config: TsConfigPathsConfig = {
      knownPackages: ['react', 'fastify', 'drizzle-orm'],
    };

    const res = resolver.resolveDetailed('src/presentation/app.ts', 'fastify', config);
    assert.strictEqual(res.kind, 'EXTERNAL');
    assert.strictEqual(res.is_external, true);
    assert.strictEqual(res.strategy, 'PACKAGE');
  });
});
