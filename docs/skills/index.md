---
title: "cogNNitive — Agent Skills"
description: "Modular agent skills that give AI agents specialized capabilities: iNNfo model authoring, document transformation, site generation, design presets, and lifecycle governance."
---

# Modular skills that give your AI agent specialized powers.

Teach your AI agent domain capabilities: iNNfo model authoring, document transformation, site generation, design presets, and skills lifecycle governance.

- [Open iNNfo Modeler App](https://cognnitive.com/innfo/app/)
- [Explore Skills Documentation](https://cognnitive.com/skills/documentation/)

---

## Featured Skills

- **nn-start**: Front controller and system governance. Handles setup, the environment readiness gate (Preflight), and routes requests to the right skill.
- **nn-innfo**: Author, edit, and validate iNNfo models, including the conversational Model Creation Wizard.
- **nn-trannsform**: Multi-modal document ingestion (PDF, DOCX, XLSX), normalization, and multi-step procedure execution.
- **nn-site-generator**: Static website generation, markdown twin hydration, and Docsify documentation suites.
- **nn-design-presets**: Complete design system with the Morado Nazareno palette, systematic typography, and an 8px grid.
- **nn-skills-lifecycle**: Skill ecosystem lifecycle, manifest pinning, and lockfile auditing.
- **nn-video-script**: Author, gate, and finalize Anydeo VUS video scripts inside an iNNfo workspace's Series/Video hierarchy.

---

## Skills Integration Architecture

```mermaid
flowchart TD
    subgraph Step1["Step 1: Ingestion & Setup"]
        U["👤 User in OpenCode"] -->|Bootstrap Prompt| Router["⚡ Agent Skills (Router & traNNsform)"]
        RawDocs["📄 Raw Documents (PDF, DOCX)"] --> Router
    end

    subgraph Step2["Step 2: Validation & Engine"]
        Router --> Models["📘 Structured Models (_NN.md)"]
        Models <--> MCP["⚙️ innfo-mcp Server + Core Engine"]
    end

    subgraph Step3["Step 3: Delivery & Access"]
        MCP <--> Modeler["🛠️ iNNfo Modeler App (Web Editor)"]
        MCP <--> AgentChat["💬 OpenCode Conversational Queries"]
    end

    subgraph Step4["Step 4: Artifact Generation"]
        Modeler & AgentChat --> Artifacts["📊 Final Deliverables\n(Visual Dashboards, Exec Summaries, Scripts)"]
    end
```

---

## How to Install & Use (OpenCode)

1. **Tell Your OpenCode Agent**: Say the single bootstrap phrase in OpenCode Desktop chat: `I want to use https://cognnitive.com/use`
2. **Skills Installed Automatically**: OpenCode fetches the manifest, downloads all skills from GitHub, and presents an interactive workflow menu.
