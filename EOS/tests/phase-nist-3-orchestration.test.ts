import * as test from 'node:test';
import * as assert from 'node:assert';
import { MultiAgentOrchestrationEngine } from '../core/engines/multi-agent-orchestration-engine';
import { MockAgentExecutor } from '../core/orchestration/agent-executors';
import { AgentResult } from '../core/domain/orchestration-contracts';

test.describe('EOS Phase 3 — Native Multi-Agent Orchestration Suite', () => {

  const baseResult: AgentResult = {
    run_id: 'test',
    agent_id: 'test',
    role: 'IMPLEMENTER',
    status: 'SUCCESS',
    evidence_ids: ['EVI-123']
  };

  test.it('SCENARIO 1: False Fix is Blocked by Reviewer (FALSE_GREEN_BLOCKED)', async () => {
    const mock = new MockAgentExecutor();
    mock.registerMock('IMPLEMENTER', { ...baseResult, role: 'IMPLEMENTER' });
    mock.registerMock('REVIEWER', { ...baseResult, role: 'REVIEWER', status: 'BLOCKED', challenges: ['Whitespace bypass detected'] });

    const engine = new MultiAgentOrchestrationEngine('FND-001', 'TGT-001', mock);
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'BLOCKED');
    assert.strictEqual(verdict.final_state, 'BLOCKED');
    assert.match(verdict.rationale, /FALSE_GREEN_BLOCKED/);
  });

  test.it('SCENARIO 2: True Fix -> VERIFIED', async () => {
    const mock = new MockAgentExecutor();
    mock.registerMock('IMPLEMENTER', { ...baseResult, role: 'IMPLEMENTER' });
    mock.registerMock('REVIEWER', { ...baseResult, role: 'REVIEWER' });
    mock.registerMock('EVIDENCE_AUDITOR', { ...baseResult, role: 'EVIDENCE_AUDITOR', evidence_ids: ['VALID_EVI_123'] });

    const engine = new MultiAgentOrchestrationEngine('FND-002', 'TGT-002', mock); 
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'VERIFIED');
    assert.strictEqual(verdict.final_state, 'VERIFIED');
  });

  test.it('SCENARIO 3: False Evidence (Insufficient payload explicitly blocks GREEN)', async () => {
    const mock = new MockAgentExecutor();
    mock.registerMock('IMPLEMENTER', { ...baseResult, role: 'IMPLEMENTER' });
    mock.registerMock('REVIEWER', { ...baseResult, role: 'REVIEWER' });
    // Auditor says SUCCESS, but evidence array is empty!
    mock.registerMock('EVIDENCE_AUDITOR', { ...baseResult, role: 'EVIDENCE_AUDITOR', status: 'SUCCESS', evidence_ids: [] });
    
    const engine = new MultiAgentOrchestrationEngine('FND-003', 'TGT-003', mock);
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'BLOCKED');
    assert.match(verdict.rationale, /EVIDENCE_GATE_FAILED/);
  });

  test.it('SCENARIO 4: Conflict -> NO MAJORITY VOTE', async () => {
    const mock = new MockAgentExecutor();
    mock.registerMock('IMPLEMENTER', { ...baseResult, role: 'IMPLEMENTER', status: 'SUCCESS' });
    mock.registerMock('REVIEWER', { ...baseResult, role: 'REVIEWER', status: 'SUCCESS' });
    mock.registerMock('EVIDENCE_AUDITOR', { ...baseResult, role: 'EVIDENCE_AUDITOR', status: 'FAILURE' });
    
    const engine = new MultiAgentOrchestrationEngine('FND-004', 'TGT-004', mock);
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'BLOCKED');
  });

  test.it('SCENARIO 5: Worker Failure -> WORKER_EXECUTION_FAILURE', async () => {
    const mock = new MockAgentExecutor();
    mock.registerMock('IMPLEMENTER', { ...baseResult, role: 'IMPLEMENTER', status: 'TIMEOUT' });
    
    const engine = new MultiAgentOrchestrationEngine('FND-005', 'TGT-005', mock);
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'BLOCKED');
    assert.strictEqual(engine.getRunState().transitions[engine.getRunState().transitions.length - 1].trigger, 'WORKER_EXECUTION_FAILURE');
  });

  test.it('SCENARIO 6: Invalid State Transition', () => {
    const mock = new MockAgentExecutor();
    const engine = new MultiAgentOrchestrationEngine('FND-006', 'TGT-006', mock);
    
    assert.throws(() => {
      // @ts-ignore
      engine['transitionTo']('VERIFIED', 'Hack');
    }, /INVALID_STATE_TRANSITION/);
  });

  test.it('SCENARIO 7: False Verdict Injection (Worker returing VERIFIED with empty evidence)', async () => {
    const mock = new MockAgentExecutor();
    mock.registerMock('IMPLEMENTER', { ...baseResult, role: 'IMPLEMENTER' });
    mock.registerMock('EVIDENCE_AUDITOR', { ...baseResult, role: 'EVIDENCE_AUDITOR', evidence_ids: ['VALID'] });
    mock.registerMock('REVIEWER', { ...baseResult, role: 'REVIEWER', verdict_claim: 'VERIFIED', evidence_ids: [] });
    
    const engine = new MultiAgentOrchestrationEngine('FND-007', 'TGT-007', mock);
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'BLOCKED');
    assert.match(verdict.rationale, /AUTHORITY_VIOLATION/);
  });

  test.it('SCENARIO 8: Mock Default Safety (Mock without explicit config fails safely)', async () => {
    const mock = new MockAgentExecutor();
    // Intentionally no mocks registered
    const engine = new MultiAgentOrchestrationEngine('FND-008', 'TGT-008', mock);
    const verdict = await engine.executeFullPipeline();

    assert.strictEqual(verdict.status, 'BLOCKED');
    assert.match(engine.getRunState().agent_runs[0].challenges![0], /NO_CONFIGURED_RESULT/);
  });
});
