import * as test from 'node:test';
import * as assert from 'node:assert';
import { SystemContext } from '../core/domain/system-context';

test.describe('EOS Phase 1 — System Context Integrity Suite', () => {
  const validBaseData = {
    system_id: 'SYS-001',
    system_name: 'AuthGateway',
    architecture_pattern: 'MICROSERVICES' as const,
    environment: 'PRODUCTION' as const,
    data_sensitivity: 'RESTRICTED' as const,
    exposure: 'PUBLIC_INTERNET' as const,
    authentication: {
      required: true,
      mechanism_types: ['JWT', 'OAUTH2'] as const,
      is_mfa_enforced: true
    },
    deployment: {
      platform: 'CLOUD_NATIVE' as const,
      containerized: true,
      orchestrator: 'KUBERNETES' as const,
      immutable_infrastructure: true
    },
    core_technologies: ['Node.js']
  };

  test.it('Deve criar uma instância válida', () => {
    const ctx = new SystemContext(validBaseData);
    assert.strictEqual(ctx.system_id, 'SYS-001');
    assert.strictEqual(ctx.environment, 'PRODUCTION');
  });

  test.it('IMMUTABILITY: Rejeita mutações na raiz (Root Level)', () => {
    const ctx = new SystemContext(validBaseData);
    assert.throws(() => { (ctx as any).system_id = 'HACKED'; }, TypeError);
    assert.throws(() => { (ctx as any).environment = 'DEVELOPMENT'; }, TypeError);
  });

  test.it('IMMUTABILITY: Rejeita mutações em nested objects (Authentication/Deployment)', () => {
    const ctx = new SystemContext(validBaseData);
    assert.throws(() => { (ctx.authentication as any).required = false; }, TypeError);
    assert.throws(() => { (ctx.deployment as any).platform = 'ON_PREMISE'; }, TypeError);
  });

  test.it('IMMUTABILITY: Rejeita mutações em nested arrays (Push, Modificação de Índice)', () => {
    const ctx = new SystemContext(validBaseData);
    assert.throws(() => { (ctx.authentication.mechanism_types as any).push('NONE'); }, TypeError);
    assert.throws(() => { (ctx.authentication.mechanism_types as any)[0] = 'BASIC'; }, TypeError);
    assert.throws(() => { (ctx.core_technologies as any).push('Malware'); }, TypeError);
  });

  test.it('INVARIANT: Rejeita campos identificadores vazios (system_id e system_name)', () => {
    assert.throws(() => { new SystemContext({ ...validBaseData, system_id: '' }); }, /system_id é obrigatório e não pode ser vazio/);
    assert.throws(() => { new SystemContext({ ...validBaseData, system_id: '   ' }); }, /system_id é obrigatório e não pode ser vazio/);
    assert.throws(() => { new SystemContext({ ...validBaseData, system_name: '' }); }, /system_name é obrigatório e não pode ser vazio/);
  });

  test.it('INVARIANT: Rejeita enums inválidos (Type Safety no construtor runtime)', () => {
    assert.throws(() => { new SystemContext({ ...validBaseData, environment: 'INVALID' as any }); }, /environment inválido/);
    assert.throws(() => { new SystemContext({ ...validBaseData, data_sensitivity: 'INVALID' as any }); }, /data_sensitivity inválida/);
    assert.throws(() => { new SystemContext({ ...validBaseData, exposure: 'INVALID' as any }); }, /exposure inválida/);
  });

  test.it('INVARIANT: Rejeita inicialização sem blocos aninhados obrigatórios', () => {
    assert.throws(() => { new SystemContext({ ...validBaseData, authentication: undefined as any }); }, /authentication struct é obrigatória/);
    assert.throws(() => { new SystemContext({ ...validBaseData, deployment: null as any }); }, /deployment struct é obrigatória/);
  });
});
