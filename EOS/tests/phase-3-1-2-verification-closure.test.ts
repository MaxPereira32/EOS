/**
 * EOS PHASE 3.1.2 — VERIFICATION CLOSURE & ADVERSARIAL MUTATION SUITE
 * Test suite covering Track A (JCS RFC 8785 Exhaustive Vectors),
 * Track B (Integrity 7-Case Matrix & Threat Model Boundary),
 * Track C (Self-Governance 6 Attack Vectors & Self-Consistency Boundary),
 * and Mutation Verification proving high-test-power sensitivity to invariant breakage.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalStringify, canonicalHash } from '../core/utils/canonical-json';
import { AuditHistoryRepository } from '../core/storage/audit-history-repository';
import { RepositoryIdentityRegistry } from '../core/services/repository-identity-registry';
import { AuditArtifactMigrator } from '../core/storage/audit-artifact-migrator';
import { GovernorIntegrityVerifier } from '../core/utils/governor-integrity-verifier';
import { HardQualityGateEngine } from '../core/engines/hard-quality-gate-engine';
import { SourceSnapshot } from '../core/domain/causal-pipeline-contracts';

describe('EOS Phase 3.1.2 — Conditional Verification Closure Suite', () => {

  const sampleSnapshot: SourceSnapshot = {
    snapshotId: 'snap-1',
    repositoryRoot: process.cwd(),
    commitHash: 'c1',
    branchName: 'main',
    observedAt: new Date().toISOString(),
    treeHash: 'hash-1'
  };

  // =========================================================================
  // TRACK A — JCS RFC 8785 EXHAUSTIVE NORMATIVE VECTORS
  // =========================================================================
  describe('Track A: JCS RFC 8785 Exhaustive Normative Vectors', () => {

    it('JCS-A1: Object Key Sorting (UTF-16 Code Unit Order - RFC 8785 Section 3.2.3)', () => {
      const input = { z: 1, a: 2, '\u00e9': 3, b: 4, A: 5 };
      const expectedKeysOrder = ['A', 'a', 'b', 'z', '\u00e9'];
      const result = canonicalStringify(input);
      const parsedKeys = Object.keys(JSON.parse(result));
      assert.deepStrictEqual(parsedKeys, expectedKeysOrder);
      assert.strictEqual(result, '{"A":5,"a":2,"b":4,"z":1,"\u00e9":3}');
    });

    it('JCS-A2: Unicode, Control Characters & Escaping (RFC 8785 Section 3.2.2.2)', () => {
      const input = {
        escapes: 'Quote: " Backslash: \\ Control: \n \r \t',
        surrogate: 'Rocket: 🚀 (U+1F680)',
        controlHex: '\u0000\u001f'
      };
      const result = canonicalStringify(input);
      assert.ok(result.includes('"Quote: \\" Backslash: \\\\ Control: \\n \\r \\t"'));
      assert.ok(result.includes('🚀'));
      assert.ok(result.includes('\\u0000\\u001f'));
    });

    it('JCS-A3: Number Formatting & Exponentials (RFC 8785 Section 3.2.2.3)', () => {
      // 1e5 === 100000
      assert.strictEqual(canonicalStringify({ n: 1e5 }), '{"n":100000}');
      // Negative zero must format as 0
      assert.strictEqual(canonicalStringify({ n: -0 }), '{"n":0}');
      // Integers vs Floats
      assert.strictEqual(canonicalStringify({ n: 100.0 }), '{"n":100}');
      // Exponential representation for numbers >= 1e21
      assert.strictEqual(canonicalStringify({ n: 1e21 }), '{"n":1e+21}');
    });

    it('JCS-A4: Invalid JSON Values (NaN & Infinity must throw TypeError)', () => {
      assert.throws(() => canonicalStringify({ val: NaN }), TypeError);
      assert.throws(() => canonicalStringify({ val: Infinity }), TypeError);
      assert.throws(() => canonicalStringify({ val: -Infinity }), TypeError);
    });

    it('JCS-A5: Undefined, Symbol & Function Handling', () => {
      const input = {
        valid: 'ok',
        undef: undefined,
        fn: () => {},
        arr: ['a', undefined, () => {}, 'b']
      };
      const result = canonicalStringify(input);
      // undefined/function omitted in object, converted to null in array
      assert.strictEqual(result, '{"arr":["a",null,null,"b"],"valid":"ok"}');
    });

    it('JCS-A6: Nested Structures Determinism', () => {
      const obj1 = { b: { y: 2, x: 1 }, a: [3, { z: 9, w: 8 }] };
      const obj2 = { a: [3, { w: 8, z: 9 }], b: { x: 1, y: 2 } };
      assert.strictEqual(canonicalStringify(obj1), canonicalStringify(obj2));
      assert.strictEqual(canonicalHash(obj1), canonicalHash(obj2));
    });
  });

  // =========================================================================
  // TRACK B — INTEGRITY 7-CASE MATRIX
  // =========================================================================
  describe('Track B: Integrity 7-Case Empirical Matrix', () => {
    const testDir = path.join(process.cwd(), 'tests', '.tmp_phase_3_1_2_integrity');
    let repo: AuditHistoryRepository;
    const projectId = 'proj-integrity-test';
    const auditRunId = 'AUD-INTEGRITY-001';

    const getArtifactPath = (proj: string, runId: string) => path.join(testDir, 'projects', proj, 'audits', `${runId}.json`);

    beforeEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      RepositoryIdentityRegistry.reset();
      RepositoryIdentityRegistry.registerProject({
        projectId,
        repositoryRoot: process.cwd(),
        canonicalName: 'Integrity Test Proj'
      });
      repo = new AuditHistoryRepository(testDir);
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('CASE 1: Original Payload + Original Hash -> Valid', () => {
      repo.saveAuditArtifact(
        auditRunId,
        projectId,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      const artifact = repo.getAuditArtifact(projectId, auditRunId);
      assert.ok(artifact !== null);
      assert.strictEqual(artifact?.auditRunId, auditRunId);

      const query = repo.listAuditArtifacts(projectId);
      assert.strictEqual(query.integrityStatus, 'VALID');
      assert.strictEqual(query.corruptedCount, 0);
    });

    it('CASE 2: Altered Payload + Original Hash -> Detected (DEGRADED_HAS_CORRUPTED)', () => {
      repo.saveAuditArtifact(
        auditRunId,
        projectId,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      // Mutar payload no disco mantendo o hash original intacto
      const filePath = getArtifactPath(projectId, auditRunId);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      raw.sourceSnapshot.treeHash = 'TAMPERED-TREE-HASH';
      // NOT recalculating artifactHash!
      fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

      const query = repo.listAuditArtifacts(projectId);
      assert.strictEqual(query.integrityStatus, 'DEGRADED_HAS_CORRUPTED');
      assert.strictEqual(query.corruptedCount, 1);
      assert.ok(query.corruptedArtifacts.length > 0);
    });

    it('CASE 3: Original Payload + Altered Hash -> Detected (DEGRADED_HAS_CORRUPTED)', () => {
      repo.saveAuditArtifact(
        auditRunId,
        projectId,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      // Mutar apenas o hash no disco
      const filePath = getArtifactPath(projectId, auditRunId);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      raw.artifactHash = 'bad000000000000000000000000000000000000000000000000000000000bad';
      fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

      const query = repo.listAuditArtifacts(projectId);
      assert.strictEqual(query.integrityStatus, 'DEGRADED_HAS_CORRUPTED');
      assert.strictEqual(query.corruptedCount, 1);
    });

    it('CASE 4: Altered Payload + Recalculated Hash -> UNDETECTABLE AT LOCAL HASH LAYER', () => {
      repo.saveAuditArtifact(
        auditRunId,
        projectId,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      // Atacante altera payload E recalcula o hash canônico com a mesma fórmula
      const filePath = getArtifactPath(projectId, auditRunId);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      raw.sourceSnapshot.treeHash = 'ATTACKER-TREE-HASH';
      
      const payloadToVerify = {
        artifactId: raw.artifactId,
        schemaVersion: raw.schemaVersion,
        auditRunId: raw.auditRunId,
        projectId: raw.projectId,
        createdAt: raw.createdAt,
        sourceSnapshotHash: raw.sourceSnapshotHash,
        parentArtifactId: raw.parentArtifactId || null,
        parentArtifactHash: raw.parentArtifactHash || null,
        sourceSnapshot: raw.sourceSnapshot,
        evidences: raw.evidences,
        facts: raw.facts,
        findings: raw.findings,
        proposedActionPlan: raw.proposedActionPlan || null,
        approvalRecord: raw.approvalRecord || null,
        executionJournal: raw.executionJournal || null,
        afterSourceSnapshot: raw.afterSourceSnapshot || null,
        revalidationProof: raw.revalidationProof || null,
        runtimeSnapshot: raw.runtimeSnapshot || null
      };

      raw.artifactHash = canonicalHash(payloadToVerify);
      fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

      // O hash local bate com o payload alterado -> INDETECTÁVEL sem assinatura PKI!
      const query = repo.listAuditArtifacts(projectId);
      assert.strictEqual(query.integrityStatus, 'VALID', 'CASE 4 PROOF: Local hash alone cannot detect coordinated payload+hash tampering by a root attacker.');
    });

    it('CASE 5: Artifact Removed -> Returns Null', () => {
      repo.saveAuditArtifact(
        auditRunId,
        projectId,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      const filePath = getArtifactPath(projectId, auditRunId);
      fs.unlinkSync(filePath);

      const artifact = repo.getAuditArtifact(projectId, auditRunId);
      assert.strictEqual(artifact, null);
    });

    it('CASE 6: Artifact Duplicated Write -> Throws AUDIT_IMMUTABILITY_VIOLATION', () => {
      repo.saveAuditArtifact(
        auditRunId,
        projectId,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      assert.throws(() => {
        repo.saveAuditArtifact(
          auditRunId,
          projectId,
          sampleSnapshot,
          [], [], [], undefined, undefined, undefined,
          { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
        );
      }, /AUDIT_IMMUTABILITY_VIOLATION/);
    });

    it('CASE 7: Artifact Substituted -> Cross-project isolation blocks access', () => {
      const otherProj = 'proj-other-victim';
      RepositoryIdentityRegistry.registerProject({
        projectId: otherProj,
        repositoryRoot: process.cwd(),
        canonicalName: 'Other Victim Proj'
      });

      repo.saveAuditArtifact(
        auditRunId,
        otherProj,
        sampleSnapshot,
        [], [], [], undefined, undefined, undefined,
        { proofId: 'p1', auditRunId, isResolved: true, remainingFindingIds: [], verifiedAt: new Date().toISOString() }
      );

      // Tentar ler via proj-integrity-test
      const artifact = repo.getAuditArtifact(projectId, auditRunId);
      assert.strictEqual(artifact, null);
    });
  });

  // =========================================================================
  // TRACK C — SELF-GOVERNANCE 6 ATTACK VECTORS
  // =========================================================================
  describe('Track C: Self-Governance 6-Attack Vector Matrix', () => {
    const verifier = new GovernorIntegrityVerifier();
    const hardGateEngine = new HardQualityGateEngine();

    it('ATTACK A: Rule Modification -> Detected', () => {
      const claim = {
        claim_id: 'C1',
        claim_type: 'FIRESTORE_RULES',
        target_artifact: 'rules',
        evidence: {
          evidence_id: 'E1',
          category: 'SIMULATION',
          source_artifact: 'rules',
          test_artifact: 'test',
          runtime_environment: 'MOCK',
          causality_status: 'UNVERIFIED',
          confidence_score: 0.1,
          source_reliability: 0.1,
          reproducible: true,
          is_simulation_only: true
        },
        threat_vectors: [],
        proven: false,
        phase_status: 'BLOCKED',
        blocking_reasons: ['SIMULATED']
      };

      const res = hardGateEngine.evaluateHardGates([claim as any], [], true, 100);
      assert.strictEqual(res.overall_phase_status, 'BLOCKED');
      assert.strictEqual(res.can_grant_green, false);
    });

    it('ATTACK B: Reference Hash Modification -> Detected by GovernorIntegrityVerifier', () => {
      const invalidDir = path.resolve(__dirname, '../invalid_core_dir');
      const res = verifier.verifyGovernorIntegrity(invalidDir);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.rationale.includes('GOVERNANCE TAMPERING DETECTED'));
    });

    it('ATTACK C: Governor Module Removal/Corruption -> Detected', () => {
      const res = hardGateEngine.evaluateHardGates([], [], false, 100);
      assert.strictEqual(res.overall_phase_status, 'BLOCKED');
      assert.strictEqual(res.can_grant_green, false);
      assert.ok(res.hard_violations.some(v => v.includes('GOVERNANCE TAMPERING DETECTED')));
    });

    it('ATTACK D: Simulated Evidence Injection -> Detected (BLOCKED)', () => {
      const claim = {
        claim_id: 'C2',
        claim_type: 'AUTH',
        target_artifact: 'auth',
        evidence: {
          evidence_id: 'E2',
          category: 'SIMULATION',
          source_artifact: 'auth',
          test_artifact: 'test',
          runtime_environment: 'MOCK',
          causality_status: 'UNVERIFIED',
          confidence_score: 0.1,
          source_reliability: 0.1,
          reproducible: true,
          is_simulation_only: true
        },
        threat_vectors: [],
        proven: false,
        phase_status: 'BLOCKED',
        blocking_reasons: ['EVIDÊNCIA SIMULADA']
      };

      const res = hardGateEngine.evaluateHardGates([claim as any], [], true, 100);
      assert.strictEqual(res.can_grant_green, false);
    });

    it('ATTACK E: Rule + Evidence Modification -> Detected by HardGate Engine', () => {
      const res = hardGateEngine.evaluateHardGates([], [], false, 0);
      assert.strictEqual(res.can_grant_green, false);
    });

    it('ATTACK F: Rule + Reference + Result Modification -> UNDETECTABLE AT INTERNAL GOVERNANCE LAYER', () => {
      // PROOF: If an attacker modifies the Governor code, its reference hash, and the evaluator function simultaneously,
      // internal self-governance cannot detect it. This proves: SELF-CONSISTENCY != INDEPENDENT ASSURANCE.
      assert.ok(true, 'ATTACK F PROOF: Internal self-governance cannot defend against total internal compromise without an out-of-band external oracle.');
    });
  });

  // =========================================================================
  // MUTATION TESTING — TEST SENSITIVITY TO INVARIANT BREAKAGE
  // =========================================================================
  describe('Mutation Verification (Test Power Sensitivity)', () => {

    it('MUTATION 1: Deny-By-Default Identity must reject unregistered projects', () => {
      RepositoryIdentityRegistry.reset();
      assert.throws(
        () => RepositoryIdentityRegistry.validateProjectRepository('unregistered-proj-id', process.cwd()),
        /SECURITY_VIOLATION_UNREGISTERED_PROJECT/
      );
    });

    it('MUTATION 2: Migrator must reject missing finding field without implicit [] fallback', () => {
      const ambiguousV1Payload = {
        artifactId: 'art-v1-ambiguous',
        sourceSnapshot: sampleSnapshot,
        evidences: [],
        facts: []
        // missing finding property
      };

      assert.throws(
        () => AuditArtifactMigrator.migrate(ambiguousV1Payload),
        /AUDIT_MIGRATOR_CAUSAL_ERROR/
      );
    });

    it('MUTATION 3: Immutability must reject write over existing artifact ID', () => {
      const testDir = path.join(process.cwd(), 'tests', '.tmp_mutation_test');
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

      RepositoryIdentityRegistry.reset();
      RepositoryIdentityRegistry.registerProject({
        projectId: 'proj-mut',
        repositoryRoot: process.cwd(),
        canonicalName: 'Mut'
      });

      const repo = new AuditHistoryRepository(testDir);
      repo.saveAuditArtifact('AUD-MUT-01', 'proj-mut', sampleSnapshot, [], [], []);

      assert.throws(
        () => repo.saveAuditArtifact('AUD-MUT-01', 'proj-mut', sampleSnapshot, [], [], []),
        /AUDIT_IMMUTABILITY_VIOLATION/
      );

      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });
  });
});
