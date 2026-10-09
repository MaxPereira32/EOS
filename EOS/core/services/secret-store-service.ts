import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EncryptedCredentialEnvelope, SecretStoreConfig } from '../domain/secret-store';
import { AgentRegistryEntry } from '../domain/agent-registry';

export interface SecretStoreContainer {
  readonly schemaVersion: number;
  readonly credentials: Record<string, EncryptedCredentialEnvelope>;
}

export class SecretStoreService {
  private readonly config: SecretStoreConfig;
  private readonly lockFilePath: string;
  private readonly machineKeyPath: string;

  constructor(customConfig?: Partial<SecretStoreConfig>, rootDir?: string) {
    const resolvedRoot = rootDir || process.cwd();
    const eosDir = path.join(resolvedRoot, '.eos');
    
    if (!fs.existsSync(eosDir)) {
      fs.mkdirSync(eosDir, { recursive: true });
    }

    const saltPath = path.join(eosDir, 'machine.salt');
    const machineSalt = this.resolveOrGenerateMachineSalt(saltPath);

    this.machineKeyPath = path.join(eosDir, 'machine.key');
    this.ensureMachineKey(this.machineKeyPath);

    this.config = {
      storeType: 'PASSPHRASE_DERIVED',
      storagePath: path.join(eosDir, 'credentials.enc.json'),
      machineSalt,
      ...customConfig
    };

    this.lockFilePath = `${this.config.storagePath}.lock`;
  }

  /**
   * Deriva um salt único por instalação persistido em arquivo com permissões estritas (0600).
   * Elimina o problema de salt determinístico por SO/Arquitetura.
   */
  private resolveOrGenerateMachineSalt(saltPath: string): string {
    if (fs.existsSync(saltPath)) {
      try {
        const salt = fs.readFileSync(saltPath, 'utf8').trim();
        if (salt.length >= 32) return salt;
      } catch {}
    }

    const newSalt = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(saltPath, newSalt, { encoding: 'utf8', mode: 0o600 });
    } catch {}
    return newSalt;
  }

  /**
   * Garante a existência de um segredo local de máquina único por instalação.
   */
  private ensureMachineKey(keyPath: string): string {
    if (fs.existsSync(keyPath)) {
      try {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        if (key.length >= 32) return key;
      } catch {}
    }

    const newKey = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(keyPath, newKey, { encoding: 'utf8', mode: 0o600 });
    } catch {}
    return newKey;
  }

  private resolvePassphrase(passphrase?: string): string {
    if (passphrase && passphrase.trim().length > 0) {
      return passphrase;
    }
    return fs.readFileSync(this.machineKeyPath, 'utf8').trim();
  }

  private deriveKey(passphrase?: string): Buffer {
    const finalPassphrase = this.resolvePassphrase(passphrase);
    return crypto.pbkdf2Sync(finalPassphrase, this.config.machineSalt, 100000, 32, 'sha256');
  }

  public generateKeyFingerprint(apiKey: string): string {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    return `...${hash.slice(-8)}`;
  }

  /**
   * Aquisição de trava de arquivo atômica para sincronização concorrente.
   */
  private acquireLock(retries = 20, delayMs = 25): number {
    for (let i = 0; i < retries; i++) {
      try {
        const lockFd = fs.openSync(this.lockFilePath, 'wx');
        return lockFd;
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          try {
            const stat = fs.statSync(this.lockFilePath);
            if (Date.now() - stat.mtimeMs > 5000) {
              fs.unlinkSync(this.lockFilePath);
            }
          } catch {}
          const end = Date.now() + delayMs;
          while (Date.now() < end) {}
        } else {
          throw err;
        }
      }
    }
    throw new Error('CONCURRENCY_ERROR_FILE_LOCK_TIMEOUT: Não foi possível adquirir a trava no credentials.enc.json');
  }

  private releaseLock(lockFd: number): void {
    try {
      fs.closeSync(lockFd);
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch {}
  }

  public storeCredential(providerId: string, apiKey: string, passphrase?: string): EncryptedCredentialEnvelope {
    const lockFd = this.acquireLock();

    try {
      const key = this.deriveKey(passphrase);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      const fingerprint = this.generateKeyFingerprint(apiKey);

      const envelope: EncryptedCredentialEnvelope = {
        providerId: providerId.toUpperCase(),
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag,
        keyFingerprint: fingerprint,
        updatedAt: new Date().toISOString()
      };

      const container = this.readContainerInternal();
      container.credentials[providerId.toUpperCase()] = envelope;
      this.writeContainerInternal(container);

      return envelope;
    } finally {
      this.releaseLock(lockFd);
    }
  }

  public retrieveCredential(providerId: string, passphrase?: string): string {
    const container = this.readContainerInternal();
    const envelope = container.credentials[providerId.toUpperCase()];

    if (!envelope) {
      throw new Error(`NOT_FOUND_ERROR: Nenhuma credencial cadastrada para o provedor '${providerId}'.`);
    }

    try {
      const key = this.deriveKey(passphrase);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));

      let decrypted = decipher.update(envelope.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err: any) {
      throw new Error(`SECURITY_VIOLATION_TAMPERING_DETECTED: A credencial do provedor '${providerId}' foi adulterada ou a chave é inválida.`);
    }
  }

  public getRegistryEntries(passphrase?: string): AgentRegistryEntry[] {
    const container = this.readContainerInternal();

    return Object.values(container.credentials).map(env => {
      let isConfigured = false;
      try {
        this.retrieveCredential(env.providerId, passphrase);
        isConfigured = true;
      } catch {
        isConfigured = false;
      }

      const providerIdClean = (['OPENAI', 'ANTHROPIC', 'GEMINI', 'CUSTOM_PROXY'].includes(env.providerId.toUpperCase())
        ? env.providerId.toUpperCase()
        : 'CUSTOM_PROXY') as 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'CUSTOM_PROXY';

      return {
        agentDefinitionId: `def-${env.providerId.toLowerCase()}`,
        providerId: providerIdClean,
        modelName: env.providerId === 'OPENAI' ? 'gpt-4o' : env.providerId === 'ANTHROPIC' ? 'claude-3-5-sonnet' : 'gemini-1.5-pro',
        status: isConfigured ? 'CONFIGURED' : 'UNCONFIGURED',
        keyFingerprint: env.keyFingerprint,
        configuredAt: env.updatedAt
      };
    });
  }

  private readContainerInternal(): { schemaVersion: number; credentials: Record<string, EncryptedCredentialEnvelope> } {
    if (!fs.existsSync(this.config.storagePath)) {
      return { schemaVersion: 1, credentials: {} };
    }

    try {
      const content = fs.readFileSync(this.config.storagePath, 'utf8');
      const data = JSON.parse(content);

      if (!data.schemaVersion) {
        return {
          schemaVersion: 1,
          credentials: data
        };
      }

      return data;
    } catch {
      return { schemaVersion: 1, credentials: {} };
    }
  }

  private writeContainerInternal(container: { schemaVersion: number; credentials: Record<string, EncryptedCredentialEnvelope> }): void {
    const dataToWrite = JSON.stringify(container, null, 2);
    fs.writeFileSync(this.config.storagePath, dataToWrite, { encoding: 'utf8', mode: 0o600 });
  }
}
