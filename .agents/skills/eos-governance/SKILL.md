---
name: eos-governance
description: Continuous Architecture Governance and Quality Gate verification using the EOS Platform and MCP Server.
---

# EOS Governance Skill

Use this skill when analyzing software architecture, checking quality gates, evaluating ADRs (Architecture Decision Records), or verifying domain boundaries and security rules using the **Engineering Operating System (EOS)**.

## MCP Tools Available

When `eos-mcp-server` is active, you have access to the following tools:

1. **`eos_run_audit`**: Run the 5-stage Continuous Architecture audit pipeline.
2. **`eos_query_graph`**: Query Domain Graph, Blast Radius score, and attack vectors.
3. **`eos_check_rules`**: Query active OWASP, CWE, NIST, and MITRE rules.
4. **`eos_get_remediation`**: Fetch machine-actionable Unified Diff patches for findings.
5. **`eos_get_context`**: Read project architecture context (`.eos/contexto.md`, `.eos/arquitetura-atual.md`).

## CLI Commands

If executing via terminal:

```bash
# Run audit pipeline
npm run audit

# Reexibir o resumo da última auditoria (sem reexecutar a esteira)
npx tsx EOS/bin/eos.ts report
# Nota: análise de Domain Graph/Blast Radius só via ferramenta MCP `eos_query_graph`;
# não existe comando CLI `graph` (removido por não ter construtor honesto).

# Generate and apply autonomous fixes
npm run fix

# Start MCP Server
npm run mcp
```
