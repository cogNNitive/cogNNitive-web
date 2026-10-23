# MCP Tools Reference

The `nn-mcp` server exposes standard tools directly to your AI coding agents.

## Core Inspection Tools

| Tool Name | Parameters | Returns | Description |
|---|---|---|---|
| `validate_knowledge` | `path: string` | Diagnostics report | Validates a single Level 3 kNNowledge file against its parent bluepriNNt. |
| `check_domain` | `domain_dir?: string` | Health summary | Audits the entire workspace, reporting schema errors and dangling citations. |
| `cognitivize` | `path: string` | Sidecar path | Creates a deterministic SHA-256 sidecar for an import file without altering the source. |
| `init_domain` | `name: string` | Workspace status | Scaffolds a new domaiNN directory layout with standard manifests. |

## Quick Command Examples

```json
{
  "name": "validate_knowledge",
  "arguments": {
    "path": "kNNowledge/architecture_NN.md"
  }
}
```
