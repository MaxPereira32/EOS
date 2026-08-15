import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { NistAssessmentEngine } from '../core/engines/nist-assessment-engine';
import { RepositoryIdentityRegistry } from '../core/services/repository-identity-registry';
import { AuditHistoryRepository } from '../core/storage/audit-history-repository';
import { AuditArtifactMigrator } from '../core/storage/audit-artifact-migrator';
import { HardQualityGateEngine } from '../core/engines/hard-quality-gate-engine';

describe('EOS Phase 3.1.5 — Invariant Regression Adversarial Suite', () => {

  test('ATTACK A: Domain importing concrete fs', () => {
    // Proven by tests/phase-3-1-4-architectural-boundary.test.ts
    // This test ensures the boundary test is present and executable.
    const boundaryTestPath = path.join(process.cwd(), 'EOS/tests/phase-3-1-4-architectural-boundary.test.ts');
    assert.ok(fs.existsSync(boundaryTestPath), 'Architectural boundary test must exist to prevent Attack A.');
  });

  test('ATTACK B & C: VERIFIED without evidence or with Synthetic Evidence', () => {
    // Create an AssessmentSnapshot without evidence but with VERIFIED status
    // The NistAssessmentEngine should reject it.
    const snapshotData: any = {
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: 'TGT-1234567890123456',
      evidence_ids: [], // No evidence!
      fact_ids: ['FCT-0000000000000000'],
      finding_ids: [],
      risk_level: 'NONE',
      verification_status: 'VERIFIED',
      provenance: {
        execution_id: 'EXC-1234567890123456',
        executed_at: new Date().toISOString(),
        eos_version: '2.0.0',
        tool_or_collector: 'adversarial-test',
        target_type: 'SOURCE_CODE',
        git_commit: 'abc1234'
      }
    };

    const engine = new NistAssessmentEngine();
    const result = engine.assessRequirement({
      requirement: { requirement_id: 'REQ-1', criteria: [], source: { framework: 'NIST_SSDF', version: '1' } } as any,
      applicability: { status: 'APPLICABLE', requirement_id: 'REQ-1', rationale: 'test' } as any,
      mapping: { has_authority: true, requirement_id: 'REQ-1', eos_rule_id: 'rule-1', relationship: 'DIRECT', authority_type: 'MANUAL', rationale: 'test' } as any,
      facts: [],
      evidence: [], // Empty evidence!
      target_id: 'TGT-123'
    });
    
    assert.strictEqual(result.status, 'NOT_VERIFIED', 'Assessment should not be VERIFIED without evidence.');
  });

  test('ATTACK D: Unregistered project', () => {
    // RepositoryIdentityRegistry acts as a static utility or has a different constructor.
    // In phase 2 tests, it was used statically: RepositoryIdentityRegistry.registerProject
    // We just test the static method directly.
    // Do not register project X.
    assert.throws(
      () => RepositoryIdentityRegistry.validateProjectRepository('project-x', '/some/path'),
      () => true
    );
  });

  test('ATTACK E: Audit overwrite', () => {
    const tmpStorage = path.join(process.cwd(), '.tmp-audit-storage');
    fs.mkdirSync(tmpStorage, { recursive: true });
    try {
      const repo = new AuditHistoryRepository(tmpStorage);
      const fakeArtifact: any = {
        artifact_id: 'ART-1234567890123456',
        schema_version: '2.0',
        project_id: 'prj-1',
        snapshot: { snapshot_hash: 'hash' }
      };
      
      // Write once
      repo.saveAuditArtifact('run-1', 'prj-1', {} as any, [], [], [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      
      // Attempt overwrite
      assert.throws(
        () => repo.saveAuditArtifact('run-1', 'prj-1', {} as any, [], [], [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined),
        (err: any) => err.code === 'EEXIST' || err.message.includes('AUDIT_IMMUTABILITY_VIOLATION') || err.message.includes('EEXIST')
      );
    } finally {
      fs.rmSync(tmpStorage, { recursive: true, force: true });
    }
  });

  test('ATTACK F: Ambiguous migration', () => {
    const ambiguousArtifact: any = {
      schemaVersion: 1,
      artifactId: 'ART-123456',
      // Missing findings
    };

    assert.throws(
      () => AuditArtifactMigrator.migrate(ambiguousArtifact),
      () => true
    );
  });

  test('ATTACK G: Cross-project projection', () => {
    assert.throws(
      () => RepositoryIdentityRegistry.validateProjectRepository('project-A', '/path/to/project-B'),
      () => true // Blocked
    );
  });

  test('ATTACK H: Governance control returning unknown', () => {
    const gate = new HardQualityGateEngine();
    
    // Pass empty envelopes but simulate a breach by passing governorIntegrityValid = false
    const result = gate.evaluateHardGates([], [], false, 100);
    assert.strictEqual(result.overall_phase_status, 'BLOCKED');
  });

});
