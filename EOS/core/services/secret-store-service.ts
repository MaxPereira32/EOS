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

  constructor(customConfig?: Partial<SecretStoreConfig>) {
    const rootDir = process.cwd();
    const eosDir = path.join(rootDir, '.eos');
    
    if (!fs.existsSync(eosDir)) {
      fs.mkdirSync(eosDir, { recursive: true });
    }

    this.config = {
      storeType: 'PASSPHRASE_DERIVED',
      storagePath: path.join(eosDir, 'credentials.enc.json'),
      machineSalt: this.resolveMachineSalt(),
      ...customConfig
    };

    this.lockFilePath = `${this.config.storagePath}.lock`;
  }

  private resolveMachineSalt(): string {
    return crypto.createHash('sha256').update(process.platform + '_' + process.arch + '_eos_salt').digest('hex');
  }

  private deriveKey(passphrase: string): Buffer {
    return crypto.pbkdf2Sync(passphrase, this.config.machineSalt, 100000, 32, 'sha256');
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
          // Checa se lock expirou (> 5 segundos)
          try {
            const stat = fs.statSync(this.lockFilePath);
            if (Date.now() - stat.mtimeMs > 5000) {
              fs.unlinkSync(this.lockFilePath);
            }
          } catch {}
          // Aguarda um pequeno intervalo síncrono
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

  public storeCredential(providerId: string, apiKey: string, passphrase = 'eos-default-local-key'): EncryptedCredentialEnvelope {
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

      const container = this.readContainerWithMigration();
      const updatedCredentials = {
        ...container.credentials,
        [envelope.providerId]: envelope
      };

      const newContainer: SecretStoreContainer = {
        schemaVersion: 1,
        credentials: updatedCredentials
      };

      const fd = fs.openSync(this.config.storagePath, 'w');
      try {
        fs.writeFileSync(fd, JSON.stringify(newContainer, null, 2), 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }

      return envelope;
    } finally {
      this.releaseLock(lockFd);
    }
  }

  public retrieveCredential(providerId: string, passphrase = 'eos-default-local-key'): string | null {
    const container = this.readContainerWithMigration();
    const envelope = container.credentials[providerId.toUpperCase()];
    if (!envelope) return null;

    try {
      const key = this.deriveKey(passphrase);
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm', 
        key, 
        Buffer.from(envelope.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));

      let decrypted = decipher.update(envelope.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      // Se houver adulteração no ciphertext, IV ou authTag, o GCM lança erro de autenticação
      throw new Error('SECURITY_VIOLATION_TAMPERING_DETECTED: A credencial salva foi adulterada ou corrompida.');
    }
  }

  public getRegistryEntries(): AgentRegistryEntry[] {
    const container = this.readContainerWithMigration();
    const providers: ('OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'CUSTOM_PROXY')[] = ['OPENAI', 'ANTHROPIC', 'GEMINI'];
    
    return providers.map(p => {
      const env = container.credentials[p];
      return {
        agentDefinitionId: `def-${p.toLowerCase()}`,
        providerId: p,
        modelName: p === 'OPENAI' ? 'gpt-4o' : p === 'ANTHROPIC' ? 'claude-3-5-sonnet' : 'gemini-1.5-pro',
        status: env ? 'CONFIGURED' : 'UNCONFIGURED',
        keyFingerprint: env ? env.keyFingerprint : undefined,
        configuredAt: env ? env.updatedAt : undefined
      };
    });
  }

  public redactLog(logText: string): string {
    return logText.replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_SECRET]');
  }

  public readContainerWithMigration(): SecretStoreContainer {
    if (!fs.existsSync(this.config.storagePath)) {
      return { schemaVersion: 1, credentials: {} };
    }
    try {
      const raw = fs.readFileSync(this.config.storagePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Suporte a migração automática de esquemas legados (sem schemaVersion)
      if (!parsed.schemaVersion) {
        return {
          schemaVersion: 1,
          credentials: parsed // Converte esquema legado onde a raiz era o Record
        };
      }

      return parsed as SecretStoreContainer;
    } catch {
      return { schemaVersion: 1, credentials: {} };
    }
  }
}
