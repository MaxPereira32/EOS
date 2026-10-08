/**
 * Secure, file-backed protocol for the EOS agent mailbox.
 *
 * This module deliberately has no capability to execute commands, resolve
 * references, or act on message text. Message content is opaque, untrusted
 * data. The stdio MCP adapter is the only public transport.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PROTOCOL_VERSION = 2;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 32 * 1024;
const MAX_PAGE_SIZE = 50;
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const PRINCIPAL_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const MESSAGE_ID_PATTERN = /^MSG-[a-f0-9]{32}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const NONCE_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9.-]{1,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const SENSITIVE_CONTENT_PATTERNS = [
  /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*\S+/i,
];

export type MailboxKind = 'REQUEST' | 'ACK' | 'STATUS' | 'REVIEW';
export type MailboxStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'REVIEWED';
export type MailboxFolder = 'inbox' | 'outbox';
type MailboxAction = 'request' | 'ack' | 'status' | 'review' | 'list' | 'read';
const ALL_ACTIONS: readonly MailboxAction[] = ['request', 'ack', 'status', 'review', 'list', 'read'];

export class MailboxError extends Error {
  public constructor(
    public readonly code: string,
    message = 'Mailbox request rejected.',
  ) {
    super(message);
    this.name = 'MailboxError';
  }
}

interface PolicyRoute {
  readonly to: string;
  readonly scopes: readonly string[];
}

interface PolicyPrincipal {
  readonly id: string;
  readonly token_sha256: string;
  readonly key_id: string;
  readonly public_key_pem: string;
  readonly actions: readonly MailboxAction[];
  readonly routes: readonly PolicyRoute[];
  readonly not_after?: string;
}

interface MailboxPolicy {
  readonly version: 2;
  readonly mailbox_root: string;
  readonly principals: readonly PolicyPrincipal[];
}

interface RecordSignature {
  readonly algorithm: 'Ed25519';
  readonly key_id: string;
  readonly value: string;
}

export interface MailboxMessage {
  readonly schema_version: 2;
  readonly id: string;
  readonly kind: MailboxKind;
  readonly status: MailboxStatus;
  readonly from: string;
  readonly to: string;
  readonly scope: string;
  readonly subject: string;
  readonly body: string;
  readonly content_hash: string;
  readonly request_id: string;
  readonly reply_to?: string;
  readonly nonce_hash?: string;
  readonly idempotency_fingerprint: string;
  readonly issued_at: string;
  readonly expires_at?: string;
  readonly signature: RecordSignature;
}

interface MailboxAuditRecord {
  readonly schema_version: 2;
  readonly event_id: string;
  readonly event: 'MESSAGE_ACCEPTED' | 'MESSAGE_REJECTED';
  readonly actor: string;
  readonly action: string;
  readonly code?: string;
  readonly message_id?: string;
  readonly request_id?: string;
  readonly kind?: MailboxKind;
  readonly status?: MailboxStatus;
  readonly message_signature?: string;
  readonly occurred_at: string;
  readonly signature: RecordSignature;
}

interface Session {
  readonly principal: PolicyPrincipal;
  readonly policy: MailboxPolicy;
  readonly root: string;
  readonly signingKey: crypto.KeyObject;
}

export interface MailboxServiceOptions {
  readonly mailboxDir: string;
  readonly policyPath: string;
  readonly principal: string;
  readonly token: string;
  readonly signingKey: string;
  readonly policyPublicKey: string;
  readonly now?: () => Date;
}

export interface MailboxSummary {
  readonly id: string;
  readonly kind: MailboxKind;
  readonly status: MailboxStatus;
  readonly from: string;
  readonly to: string;
  readonly scope: string;
  readonly subjectHash: string;
  readonly requestId: string;
  readonly replyTo?: string;
  readonly issuedAt: string;
  readonly expiresAt?: string;
  readonly contentHash: string;
  readonly contentClassification: 'UNTRUSTED_AGENT_MESSAGE';
}

export interface MailboxListResult {
  readonly folder: MailboxFolder;
  readonly messages: readonly MailboxSummary[];
  readonly nextCursor?: string;
}

export interface MailboxCapabilities {
  readonly protocolVersion: 2;
  readonly principal: string;
  readonly tools: readonly string[];
  readonly contentClassification: 'UNTRUSTED_AGENT_MESSAGE';
  readonly humanApproval: 'OUT_OF_BAND_REQUIRED';
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => withoutUndefined(item)) as T;
  if (!isObject(value)) return value;
  const normalized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested !== undefined) normalized[key] = withoutUndefined(nested);
  }
  return normalized as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string, maximum?: number): string {
  if (typeof value !== 'string' || value.length === 0 || (maximum !== undefined && value.length > maximum)) {
    throw new MailboxError('E_INPUT', `Invalid ${label}.`);
  }
  return value;
}

function assertExactKeys(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isObject(value)) throw new MailboxError('E_INPUT', 'Arguments must be an object.');
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new MailboxError('E_INPUT', `Unexpected argument: ${key}.`);
  }
  return value;
}

function assertIdentifier(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) throw new MailboxError('E_INPUT', `Invalid ${label}.`);
  return value;
}

function assertNoSensitiveContent(value: string): void {
  if (SENSITIVE_CONTENT_PATTERNS.some(pattern => pattern.test(value))) {
    throw new MailboxError('E_SENSITIVE_CONTENT', 'Message content appears to contain a secret.');
  }
}

function assertIsoTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label);
  if (!ISO_DATE_PATTERN.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new MailboxError('E_CONFIGURATION', `Invalid ${label}.`);
  }
  return timestamp;
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function publicKeyFingerprint(key: crypto.KeyObject | string): string {
  const publicKey = typeof key === 'string' ? crypto.createPublicKey(key) : crypto.createPublicKey(key);
  if (publicKey.asymmetricKeyType !== 'ed25519') throw new MailboxError('E_CONFIGURATION', 'Mailbox key must use Ed25519.');
  return crypto.createHash('sha256').update(publicKey.export({ format: 'der', type: 'spki' })).digest('hex');
}

function safeErrorCode(error: unknown): string {
  return error instanceof MailboxError ? error.code : 'E_INTERNAL';
}

function assertRegularFile(filePath: string): void {
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new MailboxError('E_STORAGE', 'Mailbox storage is not a regular file.');
  }
}

function ensureSafeDirectory(directory: string): string {
  if (!path.isAbsolute(directory)) throw new MailboxError('E_CONFIGURATION', 'Mailbox directory must be absolute.');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stats = fs.lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new MailboxError('E_STORAGE', 'Mailbox directory is unsafe.');
  }
  return fs.realpathSync.native(directory);
}

function safeChild(root: string, ...parts: string[]): string {
  const candidate = path.resolve(root, ...parts);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!candidate.startsWith(prefix)) throw new MailboxError('E_STORAGE', 'Mailbox path escapes its root.');
  return candidate;
}

function writeExclusiveJson(filePath: string, value: unknown): void {
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function readJson(filePath: string): unknown {
  assertRegularFile(filePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox record is corrupt.');
  }
}

function signed<T extends Record<string, unknown>>(core: T, keyId: string, signingKey: crypto.KeyObject): T & { signature: RecordSignature } {
  const normalized = withoutUndefined(core);
  return {
    ...normalized,
    signature: {
      algorithm: 'Ed25519',
      key_id: keyId,
      value: crypto.sign(null, Buffer.from(stableJson(normalized), 'utf8'), signingKey).toString('base64'),
    },
  };
}

function policyPrincipal(policy: MailboxPolicy, id: string): PolicyPrincipal {
  const principal = policy.principals.find(candidate => candidate.id === id);
  if (!principal) throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox signer is unknown.');
  return principal;
}

function hasRoute(policy: MailboxPolicy, from: string, to: string, scope: string): boolean {
  try {
    return policyPrincipal(policy, from).routes.some(route => route.to === to && route.scopes.includes(scope));
  } catch {
    return false;
  }
}

function verifySigned(value: unknown, policy: MailboxPolicy, signerId: string): Record<string, unknown> {
  if (!isObject(value) || !isObject(value.signature)) throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox record lacks a signature.');
  const signature = value.signature;
  const signer = policyPrincipal(policy, signerId);
  if (signature.algorithm !== 'Ed25519' || signature.key_id !== signer.key_id || typeof signature.value !== 'string') {
    throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox record has an invalid signature.');
  }
  const core = { ...value };
  delete core.signature;
  let valid = false;
  try {
    valid = crypto.verify(null, Buffer.from(stableJson(core), 'utf8'), crypto.createPublicKey(signer.public_key_pem), Buffer.from(signature.value, 'base64'));
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new MailboxError('E_TAMPERED_RECORD', 'Mailbox record integrity check failed.');
  }
  return value;
}

function verifyPolicySignature(value: unknown, policyPublicKey: string): Record<string, unknown> {
  if (!isObject(value) || !isObject(value.policy_signature)) {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy lacks a signature.');
  }
  const signature = value.policy_signature;
  if (signature.algorithm !== 'Ed25519' || typeof signature.value !== 'string') {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy signature is invalid.');
  }
  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey(policyPublicKey);
    if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('not Ed25519');
  } catch {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy verification key is invalid.');
  }
  const core = { ...value };
  delete core.policy_signature;
  if (!crypto.verify(null, Buffer.from(stableJson(core), 'utf8'), publicKey, Buffer.from(signature.value, 'base64'))) {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy signature check failed.');
  }
  return core;
}

function parsePolicy(policyPath: string, policyPublicKey: string): MailboxPolicy {
  if (!path.isAbsolute(policyPath) || !fs.existsSync(policyPath)) {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy is unavailable.');
  }
  const raw = verifyPolicySignature(readJson(policyPath), policyPublicKey);
  if (!isObject(raw) || raw.version !== 2 || !Array.isArray(raw.principals)) {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy is invalid.');
  }
  const mailboxRoot = requireString(raw.mailbox_root, 'mailbox_root');
  if (!path.isAbsolute(mailboxRoot)) {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy is invalid.');
  }
  const principals: PolicyPrincipal[] = raw.principals.map((candidate): PolicyPrincipal => {
    if (!isObject(candidate) || !Array.isArray(candidate.routes) || !Array.isArray(candidate.actions)) {
      throw new MailboxError('E_CONFIGURATION', 'Mailbox principal is invalid.');
    }
    const id = assertIdentifier(requireString(candidate.id, 'principal id'), PRINCIPAL_PATTERN, 'principal id');
    const tokenHash = requireString(candidate.token_sha256, 'token_sha256');
    if (!SHA256_PATTERN.test(tokenHash)) throw new MailboxError('E_CONFIGURATION', 'Mailbox principal token is invalid.');
    const keyId = requireString(candidate.key_id, 'key_id', 100);
    const publicKeyPem = requireString(candidate.public_key_pem, 'public_key_pem', 4096);
    try {
      publicKeyFingerprint(publicKeyPem);
    } catch {
      throw new MailboxError('E_CONFIGURATION', 'Mailbox principal public key is invalid.');
    }
    const routes = candidate.routes.map((route): PolicyRoute => {
      if (!isObject(route) || !Array.isArray(route.scopes)) throw new MailboxError('E_CONFIGURATION', 'Mailbox route is invalid.');
      const to = assertIdentifier(requireString(route.to, 'route recipient'), PRINCIPAL_PATTERN, 'route recipient');
      const scopes = route.scopes.map(scope => assertIdentifier(requireString(scope, 'route scope'), SCOPE_PATTERN, 'route scope'));
      if (scopes.length === 0) throw new MailboxError('E_CONFIGURATION', 'Mailbox route has no scopes.');
      return { to, scopes };
    });
    const actions = candidate.actions.map(action => {
      if (typeof action !== 'string' || !ALL_ACTIONS.includes(action as MailboxAction)) {
        throw new MailboxError('E_CONFIGURATION', 'Mailbox principal action is invalid.');
      }
      return action as MailboxAction;
    });
    if (actions.length === 0 || new Set(actions).size !== actions.length) {
      throw new MailboxError('E_CONFIGURATION', 'Mailbox principal actions are invalid.');
    }
    const notAfter = candidate.not_after === undefined ? undefined : assertIsoTimestamp(candidate.not_after, 'not_after');
    return { id, token_sha256: tokenHash, key_id: keyId, public_key_pem: publicKeyPem, actions, routes, not_after: notAfter };
  });
  if (principals.length === 0 || new Set(principals.map(principal => principal.id)).size !== principals.length) {
    throw new MailboxError('E_CONFIGURATION', 'Mailbox policy principals are invalid.');
  }
  return {
    version: 2,
    mailbox_root: mailboxRoot,
    principals,
  };
}

function parseMessage(value: unknown, session: Session): MailboxMessage {
  if (!isObject(value)) throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox message is invalid.');
  const messageFrom = assertIdentifier(requireString(value.from, 'message sender'), PRINCIPAL_PATTERN, 'message sender');
  const record = verifySigned(value, session.policy, messageFrom);
  const kind = record.kind;
  const status = record.status;
  if (record.schema_version !== PROTOCOL_VERSION || typeof kind !== 'string' || typeof status !== 'string' ||
    !['REQUEST', 'ACK', 'STATUS', 'REVIEW'].includes(kind) ||
    !['PENDING', 'RECEIVED', 'REJECTED', 'IN_PROGRESS', 'FAILED', 'REVIEWED'].includes(status)) {
    throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox message schema is invalid.');
  }
  const id = assertIdentifier(requireString(record.id, 'message id'), MESSAGE_ID_PATTERN, 'message id');
  const from = assertIdentifier(requireString(record.from, 'message sender'), PRINCIPAL_PATTERN, 'message sender');
  const to = assertIdentifier(requireString(record.to, 'message recipient'), PRINCIPAL_PATTERN, 'message recipient');
  const scope = assertIdentifier(requireString(record.scope, 'message scope'), SCOPE_PATTERN, 'message scope');
  if (!hasRoute(session.policy, from, to, scope)) {
    throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox message route is invalid.');
  }
  const subject = requireString(record.subject, 'subject', MAX_SUBJECT_LENGTH);
  const body = requireString(record.body, 'body', MAX_BODY_LENGTH);
  const contentHash = requireString(record.content_hash, 'content_hash');
  const requestId = assertIdentifier(requireString(record.request_id, 'request_id'), MESSAGE_ID_PATTERN, 'request_id');
  const fingerprint = requireString(record.idempotency_fingerprint, 'idempotency_fingerprint');
  const issuedAt = assertIsoTimestamp(record.issued_at, 'issued_at');
  const replyTo = record.reply_to === undefined ? undefined : assertIdentifier(requireString(record.reply_to, 'reply_to'), MESSAGE_ID_PATTERN, 'reply_to');
  const expiresAt = record.expires_at === undefined ? undefined : assertIsoTimestamp(record.expires_at, 'expires_at');
  const nonceHash = record.nonce_hash === undefined ? undefined : requireString(record.nonce_hash, 'nonce_hash');
  if (!SHA256_PATTERN.test(contentHash) || !SHA256_PATTERN.test(fingerprint) || (nonceHash !== undefined && !SHA256_PATTERN.test(nonceHash))) {
    throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox message hashes are invalid.');
  }
  if (contentHash !== sha256(`${subject}\n${body}`)) throw new MailboxError('E_TAMPERED_RECORD', 'Mailbox content hash check failed.');
  return record as unknown as MailboxMessage;
}

function parseAudit(value: unknown, session: Session): MailboxAuditRecord {
  if (!isObject(value)) throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox audit is invalid.');
  const actor = assertIdentifier(requireString(value.actor, 'audit actor'), PRINCIPAL_PATTERN, 'audit actor');
  const record = verifySigned(value, session.policy, actor);
  if (record.schema_version !== PROTOCOL_VERSION || (record.event !== 'MESSAGE_ACCEPTED' && record.event !== 'MESSAGE_REJECTED')) {
    throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox audit schema is invalid.');
  }
  return record as unknown as MailboxAuditRecord;
}

function summary(message: MailboxMessage): MailboxSummary {
  return {
    id: message.id,
    kind: message.kind,
    status: message.status,
    from: message.from,
    to: message.to,
    scope: message.scope,
    subjectHash: sha256(message.subject),
    requestId: message.request_id,
    replyTo: message.reply_to,
    issuedAt: message.issued_at,
    expiresAt: message.expires_at,
    contentHash: message.content_hash,
    contentClassification: 'UNTRUSTED_AGENT_MESSAGE',
  };
}

export class AgentMailboxService {
  private readonly session: Session;
  private readonly now: () => Date;
  private readonly messagesDir: string;
  private readonly auditDir: string;

  public constructor(options: MailboxServiceOptions) {
    this.now = options.now ?? (() => new Date());
    const policy = parsePolicy(options.policyPath, options.policyPublicKey);
    const expectedRoot = path.resolve(policy.mailbox_root);
    const configuredRoot = path.resolve(options.mailboxDir);
    if (expectedRoot !== configuredRoot) throw new MailboxError('E_CONFIGURATION', 'Mailbox root does not match policy.');
    const principal = assertIdentifier(options.principal, PRINCIPAL_PATTERN, 'principal');
    const principalPolicy = policy.principals.find(candidate => candidate.id === principal);
    if (!principalPolicy || !timingSafeEqualHex(principalPolicy.token_sha256, sha256(options.token))) {
      throw new MailboxError('E_AUTHENTICATION', 'Mailbox principal authentication failed.');
    }
    let signingKey: crypto.KeyObject;
    try {
      signingKey = crypto.createPrivateKey(options.signingKey);
      if (signingKey.asymmetricKeyType !== 'ed25519' || publicKeyFingerprint(signingKey) !== publicKeyFingerprint(principalPolicy.public_key_pem)) {
        throw new Error('key mismatch');
      }
    } catch {
      throw new MailboxError('E_AUTHENTICATION', 'Mailbox signing key authentication failed.');
    }
    if (principalPolicy.not_after && Date.parse(principalPolicy.not_after) <= this.now().getTime()) {
      throw new MailboxError('E_AUTHENTICATION', 'Mailbox principal credential expired.');
    }
    const root = ensureSafeDirectory(configuredRoot);
    this.messagesDir = ensureSafeDirectory(safeChild(root, 'messages'));
    this.auditDir = ensureSafeDirectory(safeChild(root, 'audit'));
    this.session = { principal: principalPolicy, policy, root, signingKey };
  }

  public static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): AgentMailboxService {
    const mailboxDir = environment.EOS_MAILBOX_DIR;
    const policyPath = environment.EOS_MAILBOX_POLICY_PATH;
    const principal = environment.EOS_MAILBOX_PRINCIPAL;
    const token = environment.EOS_MAILBOX_TOKEN;
    const signingKey = environment.EOS_MAILBOX_SIGNING_KEY;
    const policyPublicKey = environment.EOS_MAILBOX_POLICY_PUBLIC_KEY;
    if (!mailboxDir || !policyPath || !principal || !token || !signingKey || !policyPublicKey) {
      throw new MailboxError('E_CONFIGURATION', 'Mailbox session is not configured.');
    }
    return new AgentMailboxService({ mailboxDir, policyPath, principal, token, signingKey, policyPublicKey });
  }

  public capabilities(): MailboxCapabilities {
    const toolsByAction: Record<MailboxAction, string> = {
      request: 'mailbox_submit_request',
      ack: 'mailbox_acknowledge',
      status: 'mailbox_update_status',
      review: 'mailbox_submit_review',
      list: 'mailbox_list',
      read: 'mailbox_read',
    };
    return {
      protocolVersion: 2,
      principal: this.session.principal.id,
      tools: this.session.principal.actions.map(action => toolsByAction[action]),
      contentClassification: 'UNTRUSTED_AGENT_MESSAGE',
      humanApproval: 'OUT_OF_BAND_REQUIRED',
    };
  }

  public submitRequest(input: unknown): MailboxMessage {
    this.assertAction('request');
    const args = assertExactKeys(input, ['to', 'scope', 'subject', 'body', 'idempotencyKey', 'requestNonce']);
    const to = assertIdentifier(requireString(args.to, 'to'), PRINCIPAL_PATTERN, 'to');
    const scope = assertIdentifier(requireString(args.scope, 'scope'), SCOPE_PATTERN, 'scope');
    const subject = requireString(args.subject, 'subject', MAX_SUBJECT_LENGTH);
    const body = requireString(args.body, 'body', MAX_BODY_LENGTH);
    const idempotencyKey = assertIdentifier(requireString(args.idempotencyKey, 'idempotencyKey'), IDEMPOTENCY_KEY_PATTERN, 'idempotencyKey');
    const requestNonce = assertIdentifier(requireString(args.requestNonce, 'requestNonce'), NONCE_PATTERN, 'requestNonce');
    assertNoSensitiveContent(subject);
    assertNoSensitiveContent(body);
    this.assertRoute(to, scope);
    const nonceHash = sha256(requestNonce);
    const id = this.messageId('mailbox_submit_request', idempotencyKey);
    const fingerprint = this.fingerprint('mailbox_submit_request', { to, scope, subject, body, requestNonce });
    const existingPath = safeChild(this.messagesDir, `${id}.json`);
    if (fs.existsSync(existingPath)) return this.assertReusable({ id, fingerprint }, this.readMessage(id));
    for (const message of this.allMessages()) {
      if (message.kind === 'REQUEST' && message.from === this.session.principal.id && message.nonce_hash === nonceHash) {
        throw new MailboxError('E_REPLAY_DETECTED', 'Request nonce has already been used.');
      }
    }
    const now = this.now();
    return this.createOrReuse({
      id,
      kind: 'REQUEST',
      status: 'PENDING',
      to,
      scope,
      subject,
      body,
      requestId: id,
      nonceHash,
      fingerprint,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
      action: 'mailbox_submit_request',
    });
  }

  public acknowledge(input: unknown): MailboxMessage {
    this.assertAction('ack');
    const args = assertExactKeys(input, ['requestId', 'status', 'body', 'idempotencyKey']);
    const request = this.readRequestForReply(requireString(args.requestId, 'requestId'));
    const status = requireString(args.status, 'status');
    if (status !== 'RECEIVED' && status !== 'REJECTED') throw new MailboxError('E_INPUT', 'Invalid acknowledgement status.');
    const body = requireString(args.body, 'body', MAX_BODY_LENGTH);
    const idempotencyKey = assertIdentifier(requireString(args.idempotencyKey, 'idempotencyKey'), IDEMPOTENCY_KEY_PATTERN, 'idempotencyKey');
    assertNoSensitiveContent(body);
    const fingerprint = this.fingerprint('mailbox_acknowledge', { requestId: request.id, status, body });
    const id = this.messageId('mailbox_acknowledge', idempotencyKey);
    const reused = this.reuseIfPresent(id, fingerprint);
    if (reused) return reused;
    this.assertAcknowledgementTransition(request.id);
    return this.createOrReuse({
      id,
      kind: 'ACK',
      status: status as 'RECEIVED' | 'REJECTED',
      to: request.from,
      scope: request.scope,
      subject: `ACK ${request.id}`,
      body,
      requestId: request.id,
      replyTo: request.id,
      fingerprint,
      issuedAt: this.now().toISOString(),
      action: 'mailbox_acknowledge',
    });
  }

  public updateStatus(input: unknown): MailboxMessage {
    this.assertAction('status');
    const args = assertExactKeys(input, ['requestId', 'status', 'body', 'idempotencyKey']);
    const request = this.readRequestForReply(requireString(args.requestId, 'requestId'));
    const status = requireString(args.status, 'status');
    if (status !== 'IN_PROGRESS' && status !== 'FAILED') throw new MailboxError('E_INPUT', 'Invalid workflow status.');
    this.requireReceivedAck(request.id);
    const body = requireString(args.body, 'body', MAX_BODY_LENGTH);
    const idempotencyKey = assertIdentifier(requireString(args.idempotencyKey, 'idempotencyKey'), IDEMPOTENCY_KEY_PATTERN, 'idempotencyKey');
    assertNoSensitiveContent(body);
    const fingerprint = this.fingerprint('mailbox_update_status', { requestId: request.id, status, body });
    const id = this.messageId('mailbox_update_status', idempotencyKey);
    const reused = this.reuseIfPresent(id, fingerprint);
    if (reused) return reused;
    this.assertStatusTransition(request.id);
    return this.createOrReuse({
      id,
      kind: 'STATUS',
      status: status as 'IN_PROGRESS' | 'FAILED',
      to: request.from,
      scope: request.scope,
      subject: `STATUS ${request.id}`,
      body,
      requestId: request.id,
      replyTo: request.id,
      fingerprint,
      issuedAt: this.now().toISOString(),
      action: 'mailbox_update_status',
    });
  }

  public submitReview(input: unknown): MailboxMessage {
    this.assertAction('review');
    const args = assertExactKeys(input, ['requestId', 'subject', 'body', 'idempotencyKey']);
    const request = this.readRequestForReply(requireString(args.requestId, 'requestId'));
    this.requireReceivedAck(request.id);
    const subject = requireString(args.subject, 'subject', MAX_SUBJECT_LENGTH);
    const body = requireString(args.body, 'body', MAX_BODY_LENGTH);
    const idempotencyKey = assertIdentifier(requireString(args.idempotencyKey, 'idempotencyKey'), IDEMPOTENCY_KEY_PATTERN, 'idempotencyKey');
    assertNoSensitiveContent(subject);
    assertNoSensitiveContent(body);
    const fingerprint = this.fingerprint('mailbox_submit_review', { requestId: request.id, subject, body });
    const id = this.messageId('mailbox_submit_review', idempotencyKey);
    const reused = this.reuseIfPresent(id, fingerprint);
    if (reused) return reused;
    this.assertReviewTransition(request.id);
    return this.createOrReuse({
      id,
      kind: 'REVIEW',
      status: 'REVIEWED',
      to: request.from,
      scope: request.scope,
      subject,
      body,
      requestId: request.id,
      replyTo: request.id,
      fingerprint,
      issuedAt: this.now().toISOString(),
      action: 'mailbox_submit_review',
    });
  }

  public list(input: unknown = {}): MailboxListResult {
    this.assertAction('list');
    const args = assertExactKeys(input, ['folder', 'limit', 'cursor']);
    const folder = args.folder === undefined ? 'inbox' : requireString(args.folder, 'folder');
    if (folder !== 'inbox' && folder !== 'outbox') throw new MailboxError('E_INPUT', 'Invalid mailbox folder.');
    const limit = args.limit === undefined ? 25 : args.limit;
    if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_PAGE_SIZE) {
      throw new MailboxError('E_INPUT', 'Invalid list limit.');
    }
    const cursor = args.cursor === undefined ? undefined : assertIdentifier(requireString(args.cursor, 'cursor'), MESSAGE_ID_PATTERN, 'cursor');
    const own = this.allMessages()
      .filter(message => folder === 'inbox' ? message.to === this.session.principal.id : message.from === this.session.principal.id)
      .sort((left, right) => left.id.localeCompare(right.id));
    const start = cursor === undefined ? 0 : own.findIndex(message => message.id === cursor) + 1;
    if (cursor !== undefined && start === 0) throw new MailboxError('E_NOT_FOUND', 'Mailbox cursor is unavailable.');
    const page = own.slice(start, start + (limit as number));
    const next = own[start + (limit as number)];
    return { folder: folder as MailboxFolder, messages: page.map(summary), nextCursor: next ? page[page.length - 1]?.id : undefined };
  }

  public read(input: unknown): MailboxMessage {
    this.assertAction('read');
    const args = assertExactKeys(input, ['id']);
    const id = assertIdentifier(requireString(args.id, 'id'), MESSAGE_ID_PATTERN, 'id');
    const message = this.readMessage(id);
    if (message.from !== this.session.principal.id && message.to !== this.session.principal.id) {
      throw new MailboxError('E_NOT_FOUND', 'Mailbox message is unavailable.');
    }
    return message;
  }

  public recordRejection(action: string, error: unknown): void {
    const code = safeErrorCode(error);
    const eventId = `DEN-${crypto.randomUUID().replace(/-/g, '')}`;
    const core: Omit<MailboxAuditRecord, 'signature'> = {
      schema_version: PROTOCOL_VERSION,
      event_id: eventId,
      event: 'MESSAGE_REJECTED',
      actor: this.session.principal.id,
      action: action.slice(0, 80),
      code,
      occurred_at: this.now().toISOString(),
    };
    try {
      writeExclusiveJson(safeChild(this.auditDir, `${eventId}.json`), signed(core, this.session.principal.key_id, this.session.signingKey));
    } catch {
      // A rejected attempt must never be turned into a successful operation merely because its audit failed.
    }
  }

  private assertRoute(to: string, scope: string): void {
    const allowed = this.session.principal.routes.some(route => route.to === to && route.scopes.includes(scope));
    if (!allowed) throw new MailboxError('E_AUTHORIZATION', 'Mailbox route is not authorized.');
  }

  private assertAction(action: MailboxAction): void {
    if (!this.session.principal.actions.includes(action)) {
      throw new MailboxError('E_AUTHORIZATION', 'Mailbox action is not authorized for this principal.');
    }
  }

  private messageId(action: string, idempotencyKey: string): string {
    return `MSG-${sha256(`${this.session.principal.id}\u0000${action}\u0000${idempotencyKey}`).slice(0, 32)}`;
  }

  private fingerprint(action: string, payload: Record<string, string>): string {
    return sha256(stableJson({ actor: this.session.principal.id, action, payload }));
  }

  private allMessages(): MailboxMessage[] {
    const messages: MailboxMessage[] = [];
    for (const entry of fs.readdirSync(this.messagesDir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !MESSAGE_ID_PATTERN.test(path.basename(entry.name, '.json')) || path.extname(entry.name) !== '.json') {
        throw new MailboxError('E_CORRUPT_RECORD', 'Mailbox directory contains an unsafe record.');
      }
      messages.push(this.readMessage(path.basename(entry.name, '.json')));
    }
    return messages;
  }

  private readMessage(id: string): MailboxMessage {
    const message = this.readStoredMessage(id);
    const auditPath = safeChild(this.auditDir, `AUD-${id}.json`);
    if (!fs.existsSync(auditPath)) throw new MailboxError('E_AUDIT_MISSING', 'Mailbox audit record is unavailable.');
    const audit = parseAudit(readJson(auditPath), this.session);
    if (audit.event !== 'MESSAGE_ACCEPTED' || audit.message_id !== id || audit.message_signature !== message.signature.value) {
      throw new MailboxError('E_TAMPERED_RECORD', 'Mailbox audit does not match message.');
    }
    return message;
  }

  private readStoredMessage(id: string): MailboxMessage {
    const messagePath = safeChild(this.messagesDir, `${id}.json`);
    if (!fs.existsSync(messagePath)) throw new MailboxError('E_NOT_FOUND', 'Mailbox message is unavailable.');
    const message = parseMessage(readJson(messagePath), this.session);
    if (message.id !== id) throw new MailboxError('E_TAMPERED_RECORD', 'Mailbox message identifier mismatch.');
    return message;
  }

  private createOrReuse(input: {
    id: string;
    kind: MailboxKind;
    status: MailboxStatus;
    to: string;
    scope: string;
    subject: string;
    body: string;
    requestId: string;
    replyTo?: string;
    nonceHash?: string;
    fingerprint: string;
    issuedAt: string;
    expiresAt?: string;
    action: string;
  }): MailboxMessage {
    const existingPath = safeChild(this.messagesDir, `${input.id}.json`);
    if (fs.existsSync(existingPath)) return this.assertReusable(input, this.readMessage(input.id));
    const core: Omit<MailboxMessage, 'signature'> = {
      schema_version: PROTOCOL_VERSION,
      id: input.id,
      kind: input.kind,
      status: input.status,
      from: this.session.principal.id,
      to: input.to,
      scope: input.scope,
      subject: input.subject,
      body: input.body,
      content_hash: sha256(`${input.subject}\n${input.body}`),
      request_id: input.requestId,
      reply_to: input.replyTo,
      nonce_hash: input.nonceHash,
      idempotency_fingerprint: input.fingerprint,
      issued_at: input.issuedAt,
      expires_at: input.expiresAt,
    };
    const message = signed(core, this.session.principal.key_id, this.session.signingKey) as MailboxMessage;
    try {
      writeExclusiveJson(existingPath, message);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new MailboxError('E_STORAGE', 'Mailbox message write failed.');
      return this.assertReusable(input, this.readMessage(input.id));
    }
    this.ensureAudit(message, input.action);
    return this.readMessage(input.id);
  }

  private ensureAudit(message: MailboxMessage, action: string): void {
    const auditCore: Omit<MailboxAuditRecord, 'signature'> = {
      schema_version: PROTOCOL_VERSION,
      event_id: `AUD-${message.id}`,
      event: 'MESSAGE_ACCEPTED',
      actor: message.from,
      action,
      message_id: message.id,
      request_id: message.request_id,
      kind: message.kind,
      status: message.status,
      message_signature: message.signature.value,
      occurred_at: message.issued_at,
    };
    const auditPath = safeChild(this.auditDir, `${auditCore.event_id}.json`);
    try {
      writeExclusiveJson(auditPath, signed(auditCore, this.session.principal.key_id, this.session.signingKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new MailboxError('E_STORAGE', 'Mailbox audit write failed.');
      }
      const existingAudit = parseAudit(readJson(auditPath), this.session);
      if (existingAudit.event !== 'MESSAGE_ACCEPTED' || existingAudit.message_id !== message.id || existingAudit.message_signature !== message.signature.value) {
        throw new MailboxError('E_TAMPERED_RECORD', 'Mailbox audit does not match message.');
      }
    }
  }

  private assertReusable(input: { fingerprint: string; id: string }, existing: MailboxMessage): MailboxMessage {
    if (existing.from !== this.session.principal.id || existing.idempotency_fingerprint !== input.fingerprint) {
      throw new MailboxError('E_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different input.');
    }
    return existing;
  }

  private readRequestForReply(requestId: string): MailboxMessage {
    const id = assertIdentifier(requestId, MESSAGE_ID_PATTERN, 'requestId');
    const request = this.readMessage(id);
    if (request.kind !== 'REQUEST' || request.to !== this.session.principal.id || request.request_id !== request.id) {
      throw new MailboxError('E_AUTHORIZATION', 'Mailbox request cannot be answered by this principal.');
    }
    if (!request.expires_at || Date.parse(request.expires_at) <= this.now().getTime()) {
      throw new MailboxError('E_REQUEST_EXPIRED', 'Mailbox request has expired.');
    }
    this.assertRoute(request.from, request.scope);
    return request;
  }

  private requireReceivedAck(requestId: string): void {
    const events = this.replyEvents(requestId);
    const received = events.filter(message => message.kind === 'ACK' && message.status === 'RECEIVED');
    if (received.length !== 1 || events.some(message => message.kind === 'ACK' && message.status === 'REJECTED')) {
      throw new MailboxError('E_STATE_TRANSITION', 'Request is not in an acknowledged state.');
    }
  }

  private replyEvents(requestId: string): MailboxMessage[] {
    return this.allMessages().filter(message =>
      message.request_id === requestId && message.reply_to === requestId && message.from === this.session.principal.id,
    );
  }

  private reuseIfPresent(id: string, fingerprint: string): MailboxMessage | undefined {
    const messagePath = safeChild(this.messagesDir, `${id}.json`);
    return fs.existsSync(messagePath) ? this.assertReusable({ id, fingerprint }, this.readMessage(id)) : undefined;
  }

  private assertAcknowledgementTransition(requestId: string): void {
    if (this.replyEvents(requestId).length !== 0) {
      throw new MailboxError('E_STATE_TRANSITION', 'Request acknowledgement already has a terminal transition.');
    }
  }

  private assertStatusTransition(requestId: string): void {
    const events = this.replyEvents(requestId);
    if (events.some(message => message.kind === 'REVIEW' || (message.kind === 'STATUS' && message.status === 'FAILED') || message.kind === 'ACK' && message.status === 'REJECTED')) {
      throw new MailboxError('E_STATE_TRANSITION', 'Request cannot receive another status transition.');
    }
    if (events.filter(message => message.kind === 'STATUS').length !== 0) {
      throw new MailboxError('E_STATE_TRANSITION', 'Request status was already recorded.');
    }
  }

  private assertReviewTransition(requestId: string): void {
    const events = this.replyEvents(requestId);
    if (events.some(message => message.kind === 'REVIEW' || (message.kind === 'STATUS' && message.status === 'FAILED') || message.kind === 'ACK' && message.status === 'REJECTED')) {
      throw new MailboxError('E_STATE_TRANSITION', 'Request cannot receive a review in its current state.');
    }
  }
}
