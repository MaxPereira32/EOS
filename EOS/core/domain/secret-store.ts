/**
 * EOS CORE DOMAIN - SECRET STORE CONTRACTS
 * Defines types for encrypted credential envelope and root-of-trust configuration.
 */

export type SecretStoreType = 'OS_KEYCHAIN' | 'PASSPHRASE_DERIVED';

export interface SecretStoreConfig {
  readonly storeType: SecretStoreType;
  readonly storagePath: string; // e.g. .eos/credentials.enc.json
  readonly machineSalt: string; // Machine-ID context parameter (non-secret salt metadata)
}

export interface EncryptedCredentialEnvelope {
  readonly providerId: string;
  readonly encryptedData: string; // AES-256-GCM ciphertext
  readonly iv: string; // 12-byte initialization vector
  readonly authTag: string; // 16-byte authentication tag
  readonly keyFingerprint: string; // SHA-256 of key tail (e.g. ...x8f2)
  readonly updatedAt: string;
}
