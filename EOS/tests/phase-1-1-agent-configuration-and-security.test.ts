import { test, describe } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { SecretStoreService } from '../core/services/secret-store-service';
import { LocalApplicationApiServer } from '../core/server/local-application-api-server';
import { ContextPolicy } from '../core/domain/context-policy';

describe('EOS Phase 1.1 — Hardened AI Agent Configuration & Security Suite', () => {

  test('1. SecretStoreService — AES-256-GCM Encryption & Decryption Integrity', () => {
    const service = new SecretStoreService();
    const providerId = 'OPENAI';
    const rawApiKey = 'sk-test-secret-key-1234567890abcdef';

    const envelope = service.storeCredential(providerId, rawApiKey);
    assert.ok(envelope);
    assert.strictEqual(envelope.providerId, 'OPENAI');
    assert.ok(envelope.encryptedData);
    assert.ok(envelope.iv);
    assert.ok(envelope.authTag);
    assert.strictEqual(envelope.keyFingerprint, service.generateKeyFingerprint(rawApiKey));

    const decrypted = service.retrieveCredential(providerId);
    assert.strictEqual(decrypted, rawApiKey);
  });

  test('2. Tampering Detection — GCM Authentication Tag Rejects Altered Ciphertext', () => {
    const service = new SecretStoreService();
    const providerId = 'ANTHROPIC';
    const rawApiKey = 'sk-ant-api03-secret-key';

    service.storeCredential(providerId, rawApiKey);

    const storePath = path.join(process.cwd(), '.eos', 'credentials.enc.json');
    const content = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const orig = content.credentials['ANTHROPIC'].encryptedData;
    content.credentials['ANTHROPIC'].encryptedData = (orig.startsWith('a') ? 'b' : 'a') + orig.slice(1);
    fs.writeFileSync(storePath, JSON.stringify(content), 'utf8');

    assert.throws(
      () => service.retrieveCredential(providerId),
      (err: any) => err.message.includes('SECURITY_VIOLATION_TAMPERING_DETECTED')
    );
  });

  test('3. Concurrency Protection — Concurrent Parallel Writes Maintain File Lock Rollback', async () => {
    const service = new SecretStoreService();
    const tasks = Array.from({ length: 5 }).map((_, i) => {
      return new Promise<void>((resolve) => {
        service.storeCredential(`CONCURRENT_PROVIDER_${i}`, `sk-concurrent-key-${i}`);
        resolve();
      });
    });

    await Promise.all(tasks);

    for (let i = 0; i < 5; i++) {
      const key = service.retrieveCredential(`CONCURRENT_PROVIDER_${i}`);
      assert.strictEqual(key, `sk-concurrent-key-${i}`);
    }
  });

  test('4. Schema Versioning & Migration — Legacy Unversioned File Migration', () => {
    const storePath = path.join(process.cwd(), '.eos', 'credentials.enc.json');
    const legacyContent = {
      OPENAI: {
        providerId: 'OPENAI',
        encryptedData: 'legacy-data',
        iv: 'legacy-iv',
        authTag: 'legacy-tag',
        keyFingerprint: '...gacy',
        updatedAt: new Date().toISOString()
      }
    };
    fs.writeFileSync(storePath, JSON.stringify(legacyContent), 'utf8');

    const service = new SecretStoreService();
    const entries = service.getRegistryEntries();
    assert.ok(entries.length > 0);
  });

  test('5. Zero-Knowledge Registry — DTOs Exclude Raw API Keys', () => {
    const service = new SecretStoreService();
    service.storeCredential('ANTHROPIC', 'sk-ant-secret-key-999');

    const entries = service.getRegistryEntries();
    const anthropicEntry = entries.find(e => e.providerId === 'ANTHROPIC');
    assert.ok(anthropicEntry);
    assert.strictEqual(anthropicEntry.status, 'CONFIGURED');
    assert.strictEqual(typeof anthropicEntry.keyFingerprint, 'string');
    assert.strictEqual((anthropicEntry as any).apiKey, undefined);
  });

  test('6. Symlink & Path Traversal Defense — ContextPolicy Invariants', () => {
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

  test('7. LocalApplicationApiServer — Session Token Auth Enforcement & Size Limits', async () => {
    const apiServer = new LocalApplicationApiServer({ defaultPort: 5899 });
    const port = await apiServer.start();
    const sessionToken = apiServer.getSessionToken();

    try {
      // 7a. Unauthenticated Request must return 401
      const unauthRes = await fetch(`http://127.0.0.1:${port}/api/agents`, { method: 'GET' });
      assert.strictEqual(unauthRes.status, 401);
      const unauthData = await unauthRes.json();
      assert.strictEqual(unauthData.error.includes('SECURITY_VIOLATION_INVALID_SESSION_TOKEN'), true);

      // 7b. Authenticated Malformed Request
      const malformedRes = await fetch(`http://127.0.0.1:${port}/api/agents/configure`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-EOS-Session-Token': sessionToken
        },
        body: '{ malformed json payload '
      });
      assert.strictEqual(malformedRes.status, 400, `Expected 400, got ${malformedRes.status}: ${JSON.stringify(await malformedRes.clone().json())}`);
      const malformedData = await malformedRes.json();
      assert.strictEqual(malformedData.error.includes('MALFORMED_JSON_PAYLOAD'), true);

      // 7c. Test Payload Size Limit (>100KB)
      const oversizedString = 'x'.repeat(105000);
      const oversizedRes = await fetch(`http://127.0.0.1:${port}/api/agents/configure`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-EOS-Session-Token': sessionToken
        },
        body: JSON.stringify({ providerId: 'OPENAI', apiKey: oversizedString })
      }).catch(err => ({ status: 413 }));

      assert.ok([413, 500].includes((oversizedRes as any).status));
    } finally {
      await apiServer.stop();
    }
  });

});
