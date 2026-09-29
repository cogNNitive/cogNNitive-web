---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
title: "Projects App"
procedures:
  - id: "calculate-critical-path"
    name: "Calculate Critical Path"
    path: "procedures/calculate_critical_path_NN.md"
  - id: "generate-status-report"
    name: "Generate Project Status Report"
    path: "procedures/generate_status_report_NN.md"
assets:
  - id: "roadmap-layout"
    name: "Roadmap Console HTML Layout"
    path: "assets/roadmap_console.html"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Project]]
  * [[Phases]]
    * [[Milestone]]
  * [[Deliverable]]
  * [[Task]]
  * [[Risk]]
  * [[Project roles]]

# NN Concept Definition

## NN Concept Definition: Project
icon:: folder-kanban
type:: text
color:: blue
weight:: 100

## NN Concept Definition: Milestone
icon:: flag
type:: list
color:: purple
weight:: 90

## NN Concept Definition: Phases
icon:: layers
type:: sequence
color:: purple
weight:: 85

## NN Concept Definition: Deliverable
icon:: package
type:: list
color:: orange
weight:: 80

## NN Concept Definition: Task
icon:: check-square
type:: list
color:: blue
weight:: 70

## NN Concept Definition: Risk
icon:: alert-triangle
type:: list
color:: red
weight:: 60

## NN Concept Definition: Project roles
icon:: users
type:: list
color:: green
weight:: 50

# NN Field Definition

## NN Field Definition: status
concept:: Task
type:: select
options:: [backlog, in_progress, blocked, done]

## NN Field Definition: priority
concept:: Task
type:: select
options:: [critical, high, medium, low]

## NN Field Definition: depends_on
concept:: Task
type:: reference
target_concepts:: [Task, Milestone]

## NN Field Definition: duration
concept:: Task
type:: string

## NN Field Definition: start_date
concept:: Task
type:: string

## NN Field Definition: due_date
concept:: Task
type:: string

## NN Field Definition: milestone
concept:: Task
type:: reference
target_concepts:: [Milestone]

## NN Field Definition: deliverable
concept:: Task
type:: reference
target_concepts:: [Deliverable]

## NN Field Definition: target_date
concept:: Milestone
type:: string

## NN Field Definition: milestone_status
concept:: Milestone
type:: select
options:: [planned, in_progress, achieved, delayed]

## NN Field Definition: phase_status
concept:: Phases
type:: select
options:: [not_started, in_progress, completed]

## NN Field Definition: start_date
concept:: Phases
type:: string

## NN Field Definition: end_date
concept:: Phases
type:: string

## NN Field Definition: impact
concept:: Risk
type:: select
options:: [high, medium, low]

## NN Field Definition: probability
concept:: Risk
type:: select
options:: [high, medium, low]

## NN Field Definition: mitigation
concept:: Risk
type:: string

## NN Field Definition: scope
concept:: Project roles
type:: select
options:: [internal, external]

# NN Marker Definition

## NN Marker Definition: health
applies_to:: [Element, Concept]
icon:: activity
color:: green
weight:: 50

# NN Matrix Definition

## NN Matrix Definition: task-roles matrix
source:: Task
target:: Project roles
values:: [Responsible, Accountable, Consulted, Informed]

## NN Matrix Definition: task-deliverables matrix
source:: Task
target:: Deliverable
values:: [Creates, Modifies, Validates]

## NN Matrix Definition: risks-milestones matrix
source:: Risk
target:: Milestone
values:: [Impacts, MitigatedIn]

# Projects Template

## A template for modeling projects, ordered phases, milestones, deliverables, sequential task dependency graphs (Gantt / CPM), risks, and RACI matrices

## Philosophy

The Projects Template is designed for modeling and tracking projects following PMBOK (Project Management Body of Knowledge) standards. It provides structured concepts to define overall project goals (`Project`), the ordered stages a project moves through (`Phases`), target milestones (`Milestone`), tangible outputs (`Deliverable`), work activities (`Task`) with sequence dependencies (`depends_on`, `duration`) for Gantt / Critical Path Analysis, risk logs (`Risk`), and team RACI accountability mapping (`Project roles`).

## Objectives

- Provide PMBOK-aligned concepts for project planning, execution, and tracking.
- Break the project lifecycle into ordered `Phases` with entrance/exit criteria and phase-level status.
- Support task dependency graphs (`depends_on`, `duration`) enabling Critical Path Method (CPM) calculations and Gantt chart generation.
- Decouple target milestones from physical deliverables and work activities.
- Enable RACI governance mapping via evaluable matrices (`task-roles matrix`).
- Maintain risk management with probability, impact, and mitigation fields linked to milestones (`risks-milestones matrix`).

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Project** | `text` | Project summary, goals, scope, and strategic context |
| **Phases** | `sequence` | Ordered stages the project moves through, with start/end dates and phase status |
| **Milestone** | `list` | Target dates and major checkpoints throughout the project lifecycle |
| **Deliverable** | `list` | Tangible or intangible work products produced by the project |
| **Task** | `list` | Sequential work items with status, priority, duration, and dependencies |
| **Risk** | `list` | Identified risks with impact, probability, and mitigation plans |
| **Project roles** | `list` | Functional project roles and stakeholders |

### Markers

| Marker | Purpose |
|---|---|
| `health` | Tracks execution health and status of project components |

### Matrices

| Matrix | Source → Target | Purpose |
|---|---|---|
| Task-Roles | Task → Project roles | RACI assignment (Responsible, Accountable, Consulted, Informed) |
| Task-Deliverables | Task → Deliverable | Product creation (Creates, Modifies, Validates) |
| Risks-Milestones | Risk → Milestone | Risk impact mapping (Impacts, MitigatedIn) |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Source→target RACI and impact tables |
| Graph edge | ❌ | Not applicable |
| Sequence | ✅ | Enabled via the `Phases` concept and Task `depends_on` / `duration` fields |

## Template

### Level 3 Model Template (Lightweight)

To create a project model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "projects_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
model_version: "V_1-0-0"
title: "<Project Title>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index

* [[Project]]
  * [[Phases]]
    * [[Milestone]]
  * [[Deliverable]]
  * [[Task]]
  * [[Risk]]
  * [[Project roles]]

# NN Project
Overall description and scope of the project.

# NN Phases
## NN Phases: Discovery
phase_status:: completed
start_date:: "2026-08-01"
end_date:: "2026-08-31"
Framing, requirements, and feasibility.

## NN Phases: Delivery
phase_status:: in_progress
start_date:: "2026-09-01"
end_date:: "2026-10-15"
Build, integrate, and test the solution.

## NN Phases: Rollout
phase_status:: not_started
start_date:: "2026-10-16"
end_date:: "2026-11-01"
Deploy to production and hand over.

# NN Milestone
## NN Milestone: Milestone 1
target_date:: "2026-09-01"
milestone_status:: planned

# NN Deliverable
## NN Deliverable: Deliverable 1
Description of output deliverable.

# NN Task
## NN Task: Task 1
status:: in_progress
priority:: high
duration:: 5d
milestone:: "Milestone 1"
deliverable:: "Deliverable 1"
Task description.

## NN Task: Task 2
status:: backlog
priority:: medium
depends_on:: "Task 1"
duration:: 3d
milestone:: "Milestone 1"
deliverable:: "Deliverable 1"
Task description.

# NN Risk
## NN Risk: Risk 1
impact:: high
probability:: medium
mitigation:: "Mitigation strategy"

# NN Project roles
## NN Project roles: Project Manager
scope:: internal

# NN matrices: task-roles matrix
| Task \ Project roles | Project Manager |
| :--- | :---: |
| Task 1 | Accountable |
| Task 2 | Responsible |
```

## Examples

### Canonical Sample

The official sample for this template is at `specs/templates/projects/samples/Ghostbusters_V_0-2-0_projects_NN.md`. It exercises project phases, milestones, deliverables, task dependencies (`depends_on`), risk mitigation, and RACI matrices.

# Concept Guidance Documentation

## Project

### Summary
Overall vision, objective, and executive summary of the project.

### Description
The Project concept is the root container for defining strategic goals, project scope, budget constraints, and overall success metrics for a business or technical initiative.

## Phases

### Summary
The distinct, ordered stages a project moves through — from framing to close-out — each with its own objectives, deliverables, and entrance/exit criteria.

### Description
Phases break the project lifecycle into a sequence of stages that structure planning, execution, and control. Typical stages are Initiation, Planning, Implementation, Verification, and Close-out. Phases are ordered (`type:: sequence`); a project advances through them, and Milestone checkpoints are typically anchored inside a phase. Use `phase_status`, `start_date`, and `end_date` to track each stage.

## Milestone

### Summary
Key date checkpoints and gates marking significant progress points in the project schedule.

### Description
A Milestone marks a zero-duration checkpoint or critical decision gate in the project timeline. Used to evaluate progress, unlock phase transitions, and verify major deliverable completion.

## Deliverable

### Summary
Specific artifacts or outcomes that must be completed to achieve project goals.

### Description
A Deliverable is a tangible output, document, software build, or physical asset created by project tasks and verified against acceptance criteria before project sign-off.

## Task

### Summary
Actionable work units with priorities, durations, and dependency sequences.

### Description
A Task represents an individual unit of work performed by project roles. Tasks use `depends_on` and `duration` to construct task dependency networks for Critical Path Method (CPM) calculations and Gantt timeline visualization.

## Risk

### Summary
Uncertain events that could negatively affect project goals, including probability, impact, and mitigation strategies.

### Description
A Risk identifies potential threats to schedule, budget, quality, or scope. Each Risk records `impact`, `probability`, and `mitigation` strategies, and maps to Milestones via the risks-milestones matrix.

## Project roles

### Summary
Functional responsibilities and team positions mapped to tasks via RACI.

### Description
Project roles define the functional actors participating in project execution. Roles carry an internal or external `scope` and are assigned to tasks through the task-roles matrix (Responsible, Accountable, Consulted, Informed).
