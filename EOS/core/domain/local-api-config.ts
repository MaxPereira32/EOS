/**
 * EOS CORE DOMAIN - LOCAL API CONFIG CONTRACTS
 * Security configuration for Local Application API Server.
 */

export interface LocalApplicationApiConfig {
  readonly bindAddress: string; // Strict localhost bind ('127.0.0.1')
  readonly defaultPort: number; // e.g. 5180, 5195
  readonly portLockFilePath: string; // .eos/api.port
  readonly sessionTokenPath: string; // .eos/session.token
  readonly allowedOrigins: readonly string[]; // ["http://localhost:5173", "http://localhost:5174"]
  readonly tokenTTLMs: number; // 28,800,000 ms (8 hours)
}
