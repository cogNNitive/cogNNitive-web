# Proposal: Three-Tier Console Architecture and Asynchronous Review

## Why

cogNNitive models currently require domain stakeholders to either interact through conversational AI prompts or edit raw files/app GUIs directly. To scale adoption across non-technical domain experts and provide reusable console UX, we need a standardized 3-tier console hierarchy and a low-friction asynchronous review workflow.

## What Changes

### 1. Three-Tier Console Architecture
- **Level 1 (Universal Core)**: `innfo-runtime` / blueprint providing universal building blocks: `ConceptPill`, `ElementPill` (with traceability icons), Concept Rail, Element Cards, and Matrices under a strict offline contract (`file://` support, zero-build, standalone JSON slot embedding).
- **Level 2 (Template Domain Consoles)**: Domain-specific views and tabs (e.g., Timeline & Domain Studio in `metrics`, Funnel in `innovation`, Org Chart in `organization`, Roadmap in `projects`) composing Level 1 primitives.
- **Level 3 (Model / Custom Consoles)**: Dedicated model-specific consoles registered within the Workspace Hub.

### 2. Review Workflow & Universal Review Summary
- **Universal Review Tab**: Standardized "Review Summary" tab across all consoles showing session draft comments and structured feedback.
- **Visual Feedback Badges**: Commented cards display visual review badges in the explorer/rail navigation.
- **User Profile Chip**: Top-right reviewer profile chip with click-to-edit name persisted in `localStorage`.
- **Standardized Export**: Feedback export naming convention aligned to `<Model>_V_<Version>_<user>_review.json`.

### 3. Formalized Three-Pathway Authorship
- **Pathway 1 (Conversational AI)**: Conversational authoring via agentic assistants for Knowledge Architects and cogNNitive Leads.
- **Pathway 2 (Direct App GUI)**: Visual modeling and direct schema editing in the cogNNitive desktop/web app.
- **Pathway 3 (Asynchronous Console Review)**: Zero-install browser review for domain stakeholders, enabling annotations and exported review JSONs with no cogNNitive internals knowledge.

## Capabilities

### New Capabilities
- `console-three-tier-architecture`: Formalizes L1 runtime primitives, L2 template domain consoles, and L3 custom model consoles.
- `console-universal-review`: Universal Review Summary tab, visual card badges, reviewer identity chip, and standard review JSON export.
- `authorship-pathways`: Formalized specification of the three authoring and review modalities.

## Impact

- Domain reviewers review models asynchronously in standalone browser consoles with clear visual feedback cues.
- Reusable L1/L2 UI components eliminate duplicated console rendering logic across templates.
- Clear separation of concerns between Knowledge Architect authoring (Pathways 1 & 2) and stakeholder review (Pathway 3).
