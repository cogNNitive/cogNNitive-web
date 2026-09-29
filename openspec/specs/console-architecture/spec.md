# Console Architecture Specification

## Purpose

Defines the 3-tier console architecture and authorship pathways across runtime primitives, domain templates, and model consoles.

## Requirements

### Requirement: Level 1 Universal Runtime Primitives

The system MUST provide Level 1 primitives (`ConceptPill`, `ElementPill` with origin icons, Concept Rail, Element Card, Matrix) in `innfo-runtime`. Primitives MUST operate offline via `file://` with zero build, hydrating from JSON slots.

#### Scenario: Rendering Level 1 primitives offline
- GIVEN an HTML console with valid JSON slots
- WHEN opened via `file://` without network
- THEN Level 1 pills, rails, and cards render interactively with traceability icons

### Requirement: Level 2 Template Domain Consoles

Template consoles MUST compose Level 1 primitives into domain-specific views (e.g., Timeline in `metrics`, Funnel in `innovation`, Org Chart in `organization`, Roadmap in `projects`) conforming to standard layout slots and events.

#### Scenario: Template view composition
- GIVEN a domain template declaring custom views
- WHEN the template console mounts
- THEN it renders domain layouts using shared Level 1 pills and cards

### Requirement: Level 3 Model Custom Consoles

Dedicated model consoles MUST register in the Workspace Hub to view compiled models, preserving navigation and filtering internal schema nodes.

#### Scenario: Model console registration in Hub
- GIVEN a compiled model artifact in the workspace
- WHEN viewed in Workspace Hub
- THEN it is accessible via a dedicated model tab

### Requirement: Three-Pathway Authorship and Review

The system MUST support three interaction pathways:
1. **Pathway 1 (Conversational AI)**: Agentic assistant dialog for architects.
2. **Pathway 2 (Direct App GUI)**: Visual modeling in the desktop/web app.
3. **Pathway 3 (Asynchronous Console Review)**: Zero-install standalone browser review for stakeholders.

#### Scenario: Stakeholder review via Pathway 3
- GIVEN a standalone HTML console artifact
- WHEN opened in a browser by a reviewer
- THEN the reviewer can inspect elements and record annotations without authoring tools
