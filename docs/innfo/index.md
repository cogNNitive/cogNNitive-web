---
title: "iNNfo — The Knowledge Modeling Hub"
description: "Model, edit, and validate knowledge models with the iNNfo Modeler browser app and your AI coding agent of choice (OpenCode Desktop, Google Antigravity, Claude Code, Cursor, Codex)."
---

# Transform your documentation into structured, validated knowledge models.

Model, edit, and query knowledge visually in your browser or conversationally with your AI coding agent of choice (OpenCode Desktop, Google Antigravity, Claude Code, Cursor, Codex).

- [Open iNNfo Modeler App](https://cognnitive.com/innfo/app/)
- [Explore Documentation](https://cognnitive.com/innfo/documentation/)

---

## What You Can Do With iNNfo

- **Visual Modeling**: Explore your documentation as interactive graph trees, block sheets, matrices, and visual diagrams.
- **Automatic Validation**: Catch broken links, missing properties, and outdated specs automatically as you edit.
- **AI & Web Editing**: Edit visually in the browser app or ask your AI coding agent (OpenCode Desktop, Claude Code, Antigravity, Cursor) to create and update models for you.

---

## Information & Engine Architecture

```mermaid
flowchart TD
    subgraph Step1["Step 1: Ingestion & Setup"]
        U["👤 User & AI Agent\n(OpenCode, Antigravity, Claude Code)"] -->|Bootstrap Prompt| Router["⚡ Agent Skills (Router & traNNsform)"]
        RawDocs["📄 Raw Documents (PDF, DOCX)"] --> Router
    end

    subgraph Step2["Step 2: Validation & Engine"]
        Router --> Models["📘 Structured Models (_NN.md)"]
        Models <--> MCP["⚙️ innfo-mcp Server + Core Engine"]
    end

    subgraph Step3["Step 3: Delivery & Access"]
        MCP <--> Modeler["🛠️ iNNfo Modeler App (Web Editor)"]
        MCP <--> AgentChat["💬 Conversational Queries & MCP Tools\n(OpenCode, Antigravity, Claude Code)"]
    end

    subgraph Step4["Step 4: Artifact Generation"]
        Modeler & AgentChat --> Artifacts["📊 Final Deliverables\n(Visual Dashboards, Exec Summaries, Scripts)"]
    end
```

---

## Use iNNfo with Your AI Coding Agent

1. **Choose Your AI Agent**: Launch OpenCode Desktop (recommended reference desktop client) or use Google Antigravity, Claude Code, Cursor, or Codex CLI.
2. **Open Your Project**: Open the workspace folder containing your documentation and models.
3. **Prompt Your Agent**: Tell your agent: `I want to use https://cognnitive.com/use`
4. **Create & Edit Models**: Ask your agent to create an iNNfo model, validate documentation, or explore structures.
