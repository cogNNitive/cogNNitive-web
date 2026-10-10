---
title: "Interaction Flows & Statechart â€” cogNNitive Skills"
description: "Deterministic state machine, decision matrix, and navigation paths across cogNNitive agent skills from the nn entry point."
html_url: https://cognnitive.com/skills/docs/#/skills/interaction-flows
generator: https://cognnitive.com/skills/nn-design-presets
---

# Interaction Flows & Statechart

**Architecture**: Finite State Machine (FSM) Â· **Design Pattern**: Front Controller Â· **Entry Point**: `nn`

---

## 1. Overview

Rather than relying on ambiguous conversational narrative, user-agent interactions in **cogNNitive** are architected as a **Deterministic State Machine (FSM)** coordinated by a **Front Controller** (`nn`). 

Whenever a user inputs `nn` or any domain trigger into an agent such as OpenCode, Claude Code, or Antigravity, the system transitions across explicit states with strict guards and governance protocols.

---

## 2. Master Ecosystem Statechart

```mermaid
stateDiagram-v2
    [*] --> Input_NN: User enters "nn" + Enter

    state "0. Activation Gate (nn-preflight)" as Gate {
        [*] --> CheckIntegrity: Run preflight-check.js
        CheckIntegrity --> OutdatedConsent: Exit code 1 (outdated or missing)
        OutdatedConsent --> SyncUpdate: "[a] Update now (Recommended)"
        OutdatedConsent --> ProceedCurrent: "[b] Continue with current"
        SyncUpdate --> CheckIntegrity
        CheckIntegrity --> GateOK: Exit code 0 (Integrity OK)
    }

    Input_NN --> Gate
    Gate --> RouterTriage: Gate passed (Zero Interruption if OK)

    state "1. Front Controller (nn)" as RouterTriage {
        [*] --> EvaluateContext: Check for intent keywords
        EvaluateContext --> IntentMenu: Ambiguous or bare "nn"
        EvaluateContext --> DispatchSkill: Clear domain intent detected
        IntentMenu --> DispatchSkill: User selects path or describes goal
    }

    state "2. Domain Skill Execution" as DomainSkills {
        state "nn-innfo (Semantic Modeling)" as Innfo {
            [*] --> ActiveModelGate: Check active model context
            ActiveModelGate --> WizardL2L3: "[a] Create model (Wizard L2 -> L3)"
            ActiveModelGate --> EditModel: "[b] Edit existing model"
            ActiveModelGate --> ValidateMCP: "[c] Validate schema with innfo-mcp"
            ActiveModelGate --> ArchAssistant: "[d] Architecture Assistant (Audit)"
            ActiveModelGate --> ExecProc: "[x] Execute model procedure"
            
            state "Model Creation Wizard" as WizardL2L3 {
                [*] --> PhaseA_Template: Phase A: Template Design (Level 2)
                PhaseA_Template --> ConfirmA: User approves Level 2 spec?
                ConfirmA --> PhaseB_Model: "Yes -> Phase B: Populate Model (Level 3)"
                ConfirmA --> PhaseA_Template: Adjust template
                PhaseB_Model --> ConfirmB: User approves Level 3 model?
                ConfirmB --> SaveModel: "Yes -> Persist to kNNowledge/"
            }
        }

        state "nn-sources (Ingestion & Pipelines)" as Sources {
            [*] --> WorkspaceCheck: Validate sources/ and kNNowledge/
            WorkspaceCheck --> Normalize: Ingest (cognitivize raw sources in place)
            Normalize --> ProcedureExecution: Execute the procedures blueprint (iNNfo/specs/bluepriNNts/procedures/spec_NN.md)
            ProcedureExecution --> ExportArtifacts: Persist deliverables to artifacts/
        }

        state "nn-site-generator (Web & UI)" as SiteGen {
            [*] --> LoadPresets: Load nn-design-presets (Morado Nazareno)
            LoadPresets --> GenerateHTML: Hydrate components / dashboard
        }

        state "nn-skills-lifecycle (Governance)" as Lifecycle {
            [*] --> ScanLocalVsManifest: Compare local pins vs remote manifest
            ScanLocalVsManifest --> DiffPreview: Present diff preview
            DiffPreview --> UserConsent: User confirms update?
            UserConsent --> ApplyUpdates: "Yes -> Update skills & MCP"
        }
    }

    RouterTriage --> Innfo: Model authoring, schema or wizard
    RouterTriage --> Sources: Documents, normalization or SOP pipeline
    RouterTriage --> SiteGen: Web design, site generation or visual assets
    RouterTriage --> Lifecycle: Skill install, audit or updates

    Innfo --> GovernanceClosing: Task completed or canceled
    Sources --> GovernanceClosing: Task completed or canceled
    SiteGen --> GovernanceClosing: Task completed or canceled
    Lifecycle --> GovernanceClosing: Task completed or canceled

    state "3. Session Close & Logging" as GovernanceClosing {
        [*] --> SaveTranscript: Save log to conversations/YYYY-MM-DD_...md
        SaveTranscript --> [*]
    }
```

---

## 3. Decision & State Transition Matrix

The table below defines the deterministic transition rules executed by the agent runtime:

| Current State | Event / Input | Guard / Condition | Agent Action | Next State |
| :--- | :--- | :--- | :--- | :--- |
| **`IDLE`** | User enters `nn` | Preflight exit code 1 | Halt execution, display outdated dependencies, prompt `[a]` or `[b]` | **`AWAITING_PREFLIGHT_CONSENT`** |
| **`IDLE`** | User enters `nn` | Preflight exit code 0 | Greet with canonical badge, inspect intent | **`ROUTER_TRIAGE`** |
| **`ROUTER_TRIAGE`** | No additional intent | Input is solely `nn` | Ask user to describe their situation in 1 sentence; present recommended option first | **`AWAITING_USER_INTENT`** |
| **`ROUTER_TRIAGE`** | "create model" / "wizard" | Matches `nn-innfo` domain | Activate `nn-innfo`, present Entry Menu `[a]` to `[y]` | **`INNFO_ENTRY`** |
| **`ROUTER_TRIAGE`** | "ingest pdf" / "transform" | Matches `nn-sources` | Activate `nn-sources`, verify workspace layout | **`SOURCES_SETUP`** |
| **`ROUTER_TRIAGE`** | "generate website" / "ui" | Matches `nn-site-generator` | Prompt for visual palette preset (`nn-design-presets`) | **`SITEGEN_STYLE_SELECTION`** |
| **`ROUTER_TRIAGE`** | "update skills" / "audit" | Matches `nn-skills-lifecycle` | Compare local commits against remote manifest | **`LIFECYCLE_DIFF_PREVIEW`** |
| **`INNFO_ENTRY`** | Option `[a]` selected | New model requested | Launch Phase A (Template design Level 2) | **`WIZARD_PHASE_A`** |
| **`WIZARD_PHASE_A`** | User approves template | Level 2 validated | Transition to Phase B (Model population Level 3) | **`WIZARD_PHASE_B`** |
| **`ACTIVE_BRANCH`** | Workflow finished / exit | Work complete or abort | Save transcript in `conversations/YYYY-MM-DD_...md` | **`CONVERSATION_LOGGED`** |

---

## 4. Governance & Interaction Rules

Every interaction path strictly enforces cogNNitive's foundational UX governance rules:

1. **Zero Unilateral Mutation (Consent First)**:  
   The agent NEVER creates, renames, moves, or deletes user files (such as raw files in `sources/import/`) without explicit confirmation.
2. **Recommended Option First**:  
   Option `[a]` or `[1]` in every choice menu MUST be prefixed with `(Recommended)`.
3. **Multi-Selection Clarification**:  
   When options are non-exclusive, the agent explicitly states: `"You can select one option or a combination (e.g. A and B)"`.
4. **Mandatory Conversation Logging**:  
   All sessions persist an audited Markdown record under `<workspace_root>/conversations/YYYY-MM-DD_<model_or_topic>.md`.
