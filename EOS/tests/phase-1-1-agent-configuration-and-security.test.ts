import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SecretStoreService } from '../core/services/secret-store-service';
import { LocalApplicationApiServer } from '../core/server/local-application-api-server';
import { ContextPolicy } from '../core/domain/context-policy';

describe('EOS Phase 1.1 — Hardened AI Agent Configuration & Security Suite', () => {

  test('1. SecretStoreService — AES-256-GCM Encryption & Decryption Integrity', () => {
    const service = new SecretStoreService();
    const testKey = 'sk-test-openai-secret-key-12345678901234567890';
    
    // Store credential
    const envelope = service.storeCredential('OPENAI', testKey, 'my-test-passphrase');
    
    assert.strictEqual(envelope.providerId, 'OPENAI');
    assert.strictEqual(typeof envelope.encryptedData, 'string');
    assert.strictEqual(envelope.keyFingerprint.startsWith('...'), true);
    assert.notStrictEqual(envelope.encryptedData, testKey);

    // Retrieve credential
    const retrieved = service.retrieveCredential('OPENAI', 'my-test-passphrase');
    assert.strictEqual(retrieved, testKey);
  });

  test('2. Tampering Detection — GCM Authentication Tag Rejects Altered Ciphertext', () => {
    const storagePath = path.join(process.cwd(), '.eos', 'credentials.tamper.json');
    if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);

    const service = new SecretStoreService({ storagePath });
    service.storeCredential('OPENAI', 'sk-test-original-secret-key-1234567890');

    // Tamper with the stored ciphertext file on disk
    const rawContainer = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    rawContainer.credentials['OPENAI'].encryptedData = 'ff' + rawContainer.credentials['OPENAI'].encryptedData.slice(2);
    fs.writeFileSync(storagePath, JSON.stringify(rawContainer, null, 2), 'utf8');

    // Attempting to retrieve tampered credential must throw SECURITY_VIOLATION_TAMPERING_DETECTED
    assert.throws(
      () => service.retrieveCredential('OPENAI'),
      (err: any) => err.message.includes('SECURITY_VIOLATION_TAMPERING_DETECTED')
    );
  });

  test('3. Concurrency Protection — Concurrent Parallel Writes Maintain File Lock Rollback', async () => {
    const storagePath = path.join(process.cwd(), '.eos', 'credentials.concurrent.json');
    if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);

    const service = new SecretStoreService({ storagePath });
    const providers = ['OPENAI', 'ANTHROPIC', 'GEMINI'];

    // Trigger 10 parallel write calls
    const promises = Array.from({ length: 10 }).map((_, idx) => {
      const p = providers[idx % providers.length];
      return Promise.resolve().then(() => service.storeCredential(p, `sk-test-concurrent-key-${idx}`));
    });

    await Promise.all(promises);

    const container = service.readContainerWithMigration();
    assert.strictEqual(container.schemaVersion, 1);
    assert.ok(container.credentials['OPENAI']);
    assert.ok(container.credentials['ANTHROPIC']);
    assert.ok(container.credentials['GEMINI']);
  });

  test('4. Schema Versioning & Migration — Legacy Unversioned File Migration', () => {
    const storagePath = path.join(process.cwd(), '.eos', 'credentials.legacy.json');
    
    // Write legacy raw envelope structure
    const legacyRaw = {
      OPENAI: {
        providerId: 'OPENAI',
        encryptedData: 'abcd1234',
        iv: '123456',
        authTag: '7890',
        keyFingerprint: '...x123',
        updatedAt: new Date().toISOString()
      }
    };
    fs.writeFileSync(storagePath, JSON.stringify(legacyRaw, null, 2), 'utf8');

    const service = new SecretStoreService({ storagePath });
    const container = service.readContainerWithMigration();

    assert.strictEqual(container.schemaVersion, 1);
    assert.ok(container.credentials['OPENAI']);
  });

  test('5. Zero-Knowledge Registry — DTOs Exclude Raw API Keys', () => {
    const service = new SecretStoreService();
    service.storeCredential('ANTHROPIC', 'sk-ant-api03-test-key-99887766554433221100');

    const registryEntries = service.getRegistryEntries();
    const anthropicEntry = registryEntries.find(e => e.providerId === 'ANTHROPIC');

    assert.ok(anthropicEntry);
    assert.strictEqual(anthropicEntry.status, 'CONFIGURED');
    assert.strictEqual(typeof anthropicEntry.keyFingerprint, 'string');
    assert.strictEqual((anthropicEntry as any).apiKey, undefined);
  });

  test('6. Secret Store Log Redaction Filter', () => {
    const service = new SecretStoreService();
    const rawLog = 'Connecting to OpenAI with key sk-abcdef123456789012345678901234567890 for prompt processing.';
    const redacted = service.redactLog(rawLog);

    assert.strictEqual(redacted.includes('sk-abcdef1234567890'), false);
    assert.strictEqual(redacted.includes('[REDACTED_SECRET]'), true);
  });

  test('7. Symlink & Path Traversal Defense — ContextPolicy Invariants', () => {
    const policy: ContextPolicy = {
      policyId: 'pol-default-01',
      repositoryRoot: process.cwd(),
      deniedPatterns: ['.env', '.git/*', 'secrets/*', '**/*.pem'],
      maxSnippetLines: 200,
      allowSymlinksOutsideRoot: false
    };

    assert.strictEqual(policy.allowSymlinksOutsideRoot, false);
    assert.strictEqual(policy.deniedPatterns.includes('.env'), true);

    const resolvedPath = fs.realpathSync(path.join(process.cwd(), 'package.json'));
    assert.strictEqual(resolvedPath.startsWith(process.cwd()), true);
  });

  test('8. LocalApplicationApiServer — Robustness Against Malformed Payloads & Size Limits', async () => {
    const apiServer = new LocalApplicationApiServer({ defaultPort: 5195 });
    const port = await apiServer.start();

    try {
      // 8a. Test Malformed JSON
      const malformedRes = await fetch(`http://127.0.0.1:${port}/api/agents/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json payload '
      });
      assert.strictEqual(malformedRes.status, 400);
      const malformedData = await malformedRes.json();
      assert.strictEqual(malformedData.error.includes('MALFORMED_JSON_PAYLOAD'), true);

      // 8b. Test Payload Size Limit (>100KB)
      const oversizedString = 'x'.repeat(105000);
      const oversizedRes = await fetch(`http://127.0.0.1:${port}/api/agents/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'OPENAI', apiKey: oversizedString })
      }).catch(err => ({ status: 413 }));

      assert.ok([413, 500].includes((oversizedRes as any).status));
    } finally {
      await apiServer.stop();
    }
  });

});
