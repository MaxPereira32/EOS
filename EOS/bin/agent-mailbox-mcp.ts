/**
 * EOS Agent Mailbox MCP v2 (stdio, JSON-RPC 2.0).
 *
 * This adapter intentionally exposes mailbox operations only. It does not
 * execute text received from a message, resolve paths from a message, or make
 * approval decisions. A valid mailbox review is never a human approval.
 */

import { AgentMailboxService, MailboxError } from '../core/services/agent-mailbox-service';

const MAX_RPC_LINE_LENGTH = 128 * 1024;

type JsonRpcId = string | number | null;

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof MailboxError) return { code: error.code, message: error.message };
  return { code: 'E_INTERNAL', message: 'Mailbox operation failed safely.' };
}

function textResult(data: unknown, isError = false): void {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: currentResponseId,
    result: {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      ...(isError ? { isError: true } : {}),
    },
  }) + '\n');
}

let currentResponseId: JsonRpcId = null;

class AgentMailboxMcpServer {
  public start(): void {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
      if (buffer.length > MAX_RPC_LINE_LENGTH) {
        buffer = '';
        this.sendRpcError(null, -32600, 'Request exceeds mailbox transport limit.');
        return;
      }
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) this.handleRawMessage(line.trim());
      }
    });
    process.stdin.on('end', () => {
      if (buffer.trim()) this.handleRawMessage(buffer.trim());
    });
  }

  private handleRawMessage(raw: string): void {
    if (raw.length > MAX_RPC_LINE_LENGTH) {
      this.sendRpcError(null, -32600, 'Request exceeds mailbox transport limit.');
      return;
    }
    try {
      this.handleRpcMessage(JSON.parse(raw));
    } catch {
      this.sendRpcError(null, -32700, 'Invalid JSON-RPC message.');
    }
  }

  private handleRpcMessage(message: unknown): void {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      this.sendRpcError(null, -32600, 'Invalid JSON-RPC request.');
      return;
    }
    const request = message as Record<string, unknown>;
    const id = request.id;
    if (id === undefined || (typeof id !== 'string' && typeof id !== 'number' && id !== null)) return;
    const method = request.method;
    if (typeof method !== 'string') {
      this.sendRpcError(id, -32600, 'Invalid JSON-RPC method.');
      return;
    }
    switch (method) {
      case 'initialize':
        this.sendResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'eos-agent-mailbox', version: '2.0.0' },
        });
        return;
      case 'ping':
        this.sendResult(id, {});
        return;
      case 'tools/list':
        this.sendResult(id, { tools: this.getToolDefinitions() });
        return;
      case 'tools/call':
        this.handleToolCall(id, request.params);
        return;
      default:
        this.sendRpcError(id, -32601, 'Method not found.');
    }
  }

  private getToolDefinitions(): readonly Record<string, unknown>[] {
    return [
      {
        name: 'mailbox_capabilities',
        description: 'Reports the authenticated mailbox capability of this runtime. It does not prove a visual ChatGPT conversation binding.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'mailbox_submit_request',
        description: 'Creates an idempotent, expiring review request. Sender identity comes from the authenticated MCP session, never from arguments.',
        inputSchema: {
          type: 'object', additionalProperties: false,
          properties: {
            to: { type: 'string' }, scope: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
            idempotencyKey: { type: 'string' }, requestNonce: { type: 'string' },
          },
          required: ['to', 'scope', 'subject', 'body', 'idempotencyKey', 'requestNonce'],
        },
      },
      {
        name: 'mailbox_acknowledge',
        description: 'Records RECEIVED or REJECTED for a request addressed to this authenticated principal.',
        inputSchema: {
          type: 'object', additionalProperties: false,
          properties: { requestId: { type: 'string' }, status: { enum: ['RECEIVED', 'REJECTED'] }, body: { type: 'string' }, idempotencyKey: { type: 'string' } },
          required: ['requestId', 'status', 'body', 'idempotencyKey'],
        },
      },
      {
        name: 'mailbox_update_status',
        description: 'Records IN_PROGRESS or FAILED after a RECEIVED acknowledgement. APPROVED is intentionally not a mailbox status.',
        inputSchema: {
          type: 'object', additionalProperties: false,
          properties: { requestId: { type: 'string' }, status: { enum: ['IN_PROGRESS', 'FAILED'] }, body: { type: 'string' }, idempotencyKey: { type: 'string' } },
          required: ['requestId', 'status', 'body', 'idempotencyKey'],
        },
      },
      {
        name: 'mailbox_submit_review',
        description: 'Records a REVIEWED technical opinion after acknowledgement. It is not human approval.',
        inputSchema: {
          type: 'object', additionalProperties: false,
          properties: { requestId: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, idempotencyKey: { type: 'string' } },
          required: ['requestId', 'subject', 'body', 'idempotencyKey'],
        },
      },
      {
        name: 'mailbox_list',
        description: 'Lists metadata only from the caller inbox or outbox. Recipient and sender filters are not accepted.',
        inputSchema: {
          type: 'object', additionalProperties: false,
          properties: { folder: { enum: ['inbox', 'outbox'] }, limit: { type: 'integer', minimum: 1, maximum: 50 }, cursor: { type: 'string' } },
        },
      },
      {
        name: 'mailbox_read',
        description: 'Reads a signed message only when the authenticated caller is an endpoint of that message.',
        inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] },
      },
    ];
  }

  private handleToolCall(id: JsonRpcId, params: unknown): void {
    currentResponseId = id;
    const request = params && typeof params === 'object' && !Array.isArray(params) ? params as Record<string, unknown> : {};
    const name = request.name;
    const args = request.arguments ?? {};
    if (typeof name !== 'string') {
      this.sendToolError('E_INPUT', 'Tool name is required.');
      return;
    }
    if (name === 'mailbox_capabilities') {
      try {
        this.sendToolResult(AgentMailboxService.fromEnvironment().capabilities());
      } catch (error) {
        const safe = safeError(error);
        this.sendToolError(safe.code, safe.message);
      }
      return;
    }
    let service: AgentMailboxService;
    try {
      service = AgentMailboxService.fromEnvironment();
    } catch (error) {
      const safe = safeError(error);
      this.sendToolError(safe.code, safe.message);
      return;
    }
    try {
      switch (name) {
        case 'mailbox_submit_request': this.sendToolResult(service.submitRequest(args)); return;
        case 'mailbox_acknowledge': this.sendToolResult(service.acknowledge(args)); return;
        case 'mailbox_update_status': this.sendToolResult(service.updateStatus(args)); return;
        case 'mailbox_submit_review': this.sendToolResult(service.submitReview(args)); return;
        case 'mailbox_list': this.sendToolResult(service.list(args)); return;
        case 'mailbox_read': this.sendToolResult(service.read(args)); return;
        default: this.sendToolError('E_UNKNOWN_TOOL', 'Mailbox tool is unavailable.'); return;
      }
    } catch (error) {
      service.recordRejection(name, error);
      const safe = safeError(error);
      this.sendToolError(safe.code, safe.message);
    }
  }

  private sendToolResult(data: unknown): void {
    textResult(data);
  }

  private sendToolError(code: string, message: string): void {
    textResult({ error: { code, message } }, true);
  }

  private sendResult(id: JsonRpcId, result: unknown): void {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  }

  private sendRpcError(id: JsonRpcId, code: number, message: string): void {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
  }
}

new AgentMailboxMcpServer().start();
