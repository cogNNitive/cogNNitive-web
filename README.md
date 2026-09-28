# cogNNitive

> Semantic Knowledge Architecture and AI Pair-Programming Ecosystem

Welcome to the **cogNNitive** monorepo. cogNNitive turns scattered ideas in human brains and computer files into a **living, structured knowledge base** powered by AI with **zero vendor lock-in** and **radical fine-grained traceability**.

---

## The Knowledge Lifecycle

```
0. External World       ➔ 1. IMPORT             ➔ 2. MANAGE              ➔ 3. EXPORT
[Brains & Files/URLs]     [sources/import/ + nn/]   [models/*_NN.md (SSOT)]   [export/ Deliverables]
          ▲                                                                           │
          └───────────────────── Human Revision & Feedback Loop ──────────────────────┘
```

1. **External World**: Knowledge originates in human brains (internal & external) and is elicited into digital files/URLs without altering how contributors capture information.
2. **Phase 1 (IMPORT)**: Ingests immutable originals with SHA-256 (`sources/import/`), uses staging buffers for extraction (`sources/staging/`), normalizes content into Markdown (`sources/nn/`), and archives snapshots on change (`sources/archive/`).
3. **Phase 2 (MANAGE)**: Structures knowledge into iNNfo Level 3 models (`models/*_NN.md`) with explicit heading-level citations (`sources:: [file.md#heading-slug]`). Accessible via text editors (Obsidian, VS Code), visual web apps (`iNNfo Modeler`), or AI pair-programming agents (`OpenCode`, `Antigravity`, `Claude Code`).
4. **Phase 3 (EXPORT)**: Generates tailored deliverables (dashboards, Word, PDF) and re-ingests reviewed documents back into the knowledge loop.

---

## Repository Structure

```text
cogNNitive/
├── docs/             # Public website (https://cognnitive.com) & agent bootstrap (/use)
│   ├── innfo/        # Documentation for iNNfo editor & core
│   ├── actionn/      # Documentation for skills catalog
│   └── use/          # Universal AI Agent manifest & bootstrap
├── iNNfo/            # Semantic modeling layer
│   ├── apps/         # innfo-editor (Vue/Vite web application)
│   ├── packages/     # innfo-core (pure TS semantic engine) & innfo-mcp (MCP server)
│   └── specs/        # Canonical iNNfo specifications, templates, and samples
├── skills/           # Agent skills (nn-innfo, nn-trannsform, nn-preflight, etc.)
├── openspec/         # Cross-system architecture RFCs and formal specifications
└── scripts/          # Workspace maintenance and verification scripts
```

## AI Agent Bootstrap

If you are an AI Agent (Claude Code, Antigravity, OpenCode, Cursor):
- Bootstrap entrypoint: [https://cognnitive.com/use](https://cognnitive.com/use) (served from `docs/use/manifest.md`)
- Semantic model entrypoint: `workspace_NN.md`

## Development & Philosophy

1. **Zero Vendor Lock-in:** Plain text Markdown files stored in your local Git repository. You own your knowledge forever.
2. **Concepts > Code:** Strict semantic modeling with clear invariants and fine-grained section traceability.
3. **Fail-Fast:** No silent fallbacks. Unmatched schemas and drifted source citations fail deterministically.
4. **Local-First:** Local workspace specifications take precedence over remote references.
5. **On-Demand Dependencies:** Skills declare dependencies declaratively; agent environments install them on-demand without bloating the core repository.

### Pre-push hook

`npm install` at the repo root wires a native `pre-push` hook via
`core.hooksPath` (`.githooks/pre-push`, no husky/lint-staged). It runs
`npm run typecheck` before every `git push` and blocks the push on a
non-zero exit. Bypass with `git push --no-verify`. Uninstall with
`git config --unset core.hooksPath`.
