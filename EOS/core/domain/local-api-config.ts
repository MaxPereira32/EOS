/**
 * EOS CORE DOMAIN - LOCAL API CONFIG CONTRACTS
 * Security configuration for Local Application API Server.
 */

export interface LocalApplicationApiConfig {
  readonly bindAddress: '127.0.0.1'; // Strict localhost bind (never 0.0.0.0)
  readonly defaultPort: 5180;
  readonly portLockFilePath: string; // .eos/api.port
  readonly sessionTokenPath: string; // .eos/session.token
  readonly allowedOrigins: readonly string[]; // ["http://localhost:5173", "http://localhost:5174"]
  readonly tokenTTLMs: number; // 28,800,000 ms (8 hours)
}
