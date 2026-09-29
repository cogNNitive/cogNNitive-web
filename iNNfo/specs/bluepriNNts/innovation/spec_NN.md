---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/innovation/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Innovation App"
procedures:
  - id: "score-innovation-pipeline"
    name: "Score Innovation Pipeline"
    path: "procedures/score_innovation_pipeline_NN.md"
assets:
  - id: "innovation-funnel-layout"
    name: "Innovation Funnel HTML Layout"
    path: "assets/innovation_funnel_console.html"
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

* [[Program]]
* [[Person]]
* [[Opportunity]]
* [[Initiative]]

# NN Concept Definition

## NN Concept Definition: Program
icon:: layers
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Person
icon:: user
type:: list
color:: green
weight:: 80

## NN Concept Definition: Opportunity
icon:: door-open
type:: list
color:: purple
weight:: 90

## NN Concept Definition: Initiative
icon:: rocket
type:: list
color:: orange
weight:: 85

# NN Field Definition

## NN Field Definition: programName
concept:: Program
type:: string

## NN Field Definition: programObjectives
concept:: Program
type:: string

## NN Field Definition: programScope
concept:: Program
type:: string

## NN Field Definition: programIndicators
concept:: Program
type:: string

## NN Field Definition: programGovernance
concept:: Program
type:: string

## NN Field Definition: programFunding
concept:: Program
type:: string

## NN Field Definition: programStages
concept:: Program
type:: string

## NN Field Definition: programReporting
concept:: Program
type:: string

## NN Field Definition: programDefaultOpportunityStatuses
concept:: Program
type:: string

## NN Field Definition: programDefaultInitiativeTypes
concept:: Program
type:: string

## NN Field Definition: personId
concept:: Person
type:: string

## NN Field Definition: personName
concept:: Person
type:: string

## NN Field Definition: personDescription
concept:: Person
type:: string

## NN Field Definition: personRole
concept:: Person
type:: string

## NN Field Definition: personUrl
concept:: Person
type:: string

## NN Field Definition: personImageUrl
concept:: Person
type:: image

## NN Field Definition: image
concept:: Person
type:: image
description:: Visual portrait or avatar representing the person.

## NN Field Definition: opportunityId
concept:: Opportunity
type:: string

## NN Field Definition: opportunityName
concept:: Opportunity
type:: string

## NN Field Definition: opportunityDescription
concept:: Opportunity
type:: string

## NN Field Definition: opportunityProblem
concept:: Opportunity
type:: string

## NN Field Definition: opportunitySource
concept:: Opportunity
type:: string

## NN Field Definition: opportunityStakeholders
concept:: Opportunity
type:: string

## NN Field Definition: opportunityProposerId
concept:: Opportunity
type:: reference
target_concepts:: [Person]

## NN Field Definition: opportunityPriority
concept:: Opportunity
type:: string

## NN Field Definition: opportunityStatus
concept:: Opportunity
type:: string

## NN Field Definition: opportunityDateIdentified
concept:: Opportunity
type:: string

## NN Field Definition: opportunityLastUpdated
concept:: Opportunity
type:: string

## NN Field Definition: initiativeId
concept:: Initiative
type:: string

## NN Field Definition: initiativeName
concept:: Initiative
type:: string

## NN Field Definition: initiativeType
concept:: Initiative
type:: string

## NN Field Definition: initiativePhase
concept:: Initiative
type:: string

## NN Field Definition: initiativeManagerId
concept:: Initiative
type:: reference
target_concepts:: [Person]

## NN Field Definition: initiativeOpportunityId
concept:: Initiative
type:: reference
target_concepts:: [Opportunity]

## NN Field Definition: initiativeUser
concept:: Initiative
type:: string

## NN Field Definition: initiativeProblem
concept:: Initiative
type:: string

## NN Field Definition: initiativeSolution
concept:: Initiative
type:: string

## NN Field Definition: initiativeValueProposition
concept:: Initiative
type:: string

## NN Field Definition: initiativeSolutionHypothesis
concept:: Initiative
type:: string

## NN Field Definition: initiativeGoals
concept:: Initiative
type:: string

## NN Field Definition: initiativeObjective
concept:: Initiative
type:: string

## NN Field Definition: initiativeResults
concept:: Initiative
type:: string

## NN Field Definition: initiativeLearnings
concept:: Initiative
type:: string

## NN Field Definition: initiativeDecision
concept:: Initiative
type:: string

## NN Field Definition: initiativeDecisionJustification
concept:: Initiative
type:: string

## NN Field Definition: initiativeNextSteps
concept:: Initiative
type:: string

## NN Field Definition: initiativeBudget
concept:: Initiative
type:: string

## NN Field Definition: initiativeResources
concept:: Initiative
type:: string

## NN Field Definition: initiativeRisks
concept:: Initiative
type:: string

## NN Field Definition: initiativeDateRegistered
concept:: Initiative
type:: string

## NN Field Definition: initiativeStartDate
concept:: Initiative
type:: string

## NN Field Definition: initiativeEndDate
concept:: Initiative
type:: string

## NN Field Definition: initiativeLastUpdated
concept:: Initiative
type:: string

## NN Field Definition: initiativeNotes
concept:: Initiative
type:: string

## NN Field Definition: initiativeBusinessModel
concept:: Initiative
type:: model
target_template:: business
description:: Business model for this initiative, as a submodel conforming to the business template.

# NN Marker Definition

## NN Marker Definition: priority
applies_to:: [Element]
symbol:: !
icon:: flag
color:: red

## NN Marker Definition: certainty
applies_to:: [Element, Concept]
symbol:: ?
icon:: help-circle
color:: green

# NN Matrix Definition

## NN Matrix Definition: program-initiatives matrix
source:: Program
target:: Initiative
values:: [Govern]
widget:: boolean

## NN Matrix Definition: opportunity-initiative matrix
source:: Opportunity
target:: Initiative
values:: [Address]
widget:: boolean

## NN Matrix Definition: person-initiative matrix
source:: Person
target:: Initiative
values:: [Sponsors, Manages, Participates]

## NN Matrix Definition: person-opportunity matrix
source:: Person
target:: Opportunity
values:: [Proposes, Champions, Evaluates]

# Innovation Template

## A template for modeling corporate innovation portfolios with programs, people, opportunities, and initiatives

## Philosophy

The iNNfo Innovation Template models an innovation portfolio: strategic programs that govern opportunities (potential initiatives) and initiatives (execution workstreams), staffed by people. It follows the four-level flow Program → Opportunity → Initiative, with governance matrices linking people to both opportunities and initiatives.

## Objectives

- Model an innovation portfolio with four core concepts: Program, Person, Opportunity, and Initiative.
- Govern opportunities and initiatives through strategic programs with clear objectives, scope, funding, and reporting.
- Prioritize opportunities with `priority` and `certainty` markers before execution.
- Link people to opportunities and initiatives via evaluable governance matrices.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Program** | `text` | The governing innovation program: objectives, scope, funding, governance, reporting |
| **Person** | `list` | People involved across the portfolio (sponsors, managers, team members, collaborators) |
| **Opportunity** | `list` | A potential initiative idea, evaluated and prioritized before execution |
| **Initiative** | `list` | An active execution workstream with budget, results, decisions, and risks |

### Markers

| Marker | Purpose |
|---|---|
| `priority` | Strategic priority score (1–10) |
| `certainty` | Confidence level (1–10) |

### Matrices

| Matrix | Source → Target | Purpose |
|---|---|---|
| program-initiatives | Program → Initiative | Program governance over initiatives |
| opportunity-initiative | Opportunity → Initiative | Which opportunity an initiative addresses |
| person-initiative | Person → Initiative | Person involvement in initiatives (Sponsors/Manages/Participates) |
| person-opportunity | Person → Opportunity | Person role on opportunities (Proposes/Champions/Evaluates) |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Source→target governance tables |
| Graph edge | ❌ | Not applicable |
| Sequence | ✅ | Enabled via opportunity-to-initiative and lifecycle stages |

## Template

### Level 3 Model Template (Lightweight)

To create an innovation portfolio model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "innovation_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/innovation/spec_NN.md"
model_version: "V_1-0-0"
title: "<Innovation Portfolio Title>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index

* [[Program]]
* [[Person]]
* [[Opportunity]]
* [[Initiative]]
```

## Examples

### Canonical Sample

The official sample for this template is at `specs/templates/innovation/samples/Ghostbusters_V_0-2-0_innovation_NN.md`. It exercises R&D programs, personnel roles, opportunity pipelines, execution initiatives, and governance matrices.

# Concept Guidance Documentation

## Program

### Summary

The governing innovation program: a single strategic container defining objectives, scope, funding sources, governance bodies, and reporting cadence for the whole portfolio.

### Description

A Program holds the strategic frame of an innovation portfolio. It declares the mission and strategic objectives, the scope of what the program covers, the indicators used to measure success, the governance structure (boards and committees) that makes decisions, the funding model, the lifecycle stages an initiative passes through, and the default statuses and types available to opportunities and initiatives.

### Methodologies

**Portfolio Management** — aligns the set of initiatives with the program's strategic objectives and measures aggregate outcomes.
**Stage-Gate Process** — routes each initiative through the program's lifecycle stages with governance checkpoints.

### Prompts

`Summarize the strategic objectives, scope, and success indicators of the innovation program.`
`Describe the governance structure, reporting cadence, and funding model of the program.`
`List the lifecycle stages, default opportunity statuses, and default initiative types used by the program.`

## Person

### Summary

A person involved across the portfolio (sponsor, manager, team member, or external collaborator) with identity, role, and profile details.

### Description

A Person represents any individual involved in the portfolio. Each person carries an identifier, name, role, and optionally a profile URL and image. Persons are linked to opportunities (as proposer, champion, or evaluator) and to initiatives (as sponsor, manager, or participant) through the governance matrices.

### Methodologies

**RACI** — clarify which person is Responsible, Accountable, Consulted, or Informed for each initiative.

### Prompts

`Describe each person's role, responsibility, and how they participate across opportunities and initiatives.`
`Map each person to the opportunities they propose or champion and the initiatives they sponsor or manage.`

## Opportunity

### Summary

A potential initiative idea that is identified, evaluated, and prioritized before entering execution as an initiative.

### Description

An Opportunity is an idea captured for consideration. It describes a problem or market trend, the stakeholders involved, and the proposer. Each opportunity is scored with a priority and tracked through a status lifecycle (Identified → Under Review → Feasibility Studied → Prioritized → Archived). When an opportunity is prioritized, it is addressed by one or more initiatives.

### Methodologies

**Opportunity Scoring** — score each opportunity on priority and certainty to build a ranked portfolio.
**Idea Funnel** — progressively triage ideas from Identified through Prioritized before execution.

### Prompts

`Describe the problem or market trend this opportunity addresses, its stakeholders, and its proposer.`
`Score the opportunity's priority and certainty, and state its current status in the lifecycle.`
`Identify which initiatives address this opportunity once it is prioritized.`

## Initiative

### Summary

An active execution workstream that addresses an opportunity, with budget, results, learnings, decisions, next steps, and risks.

### Description

An Initiative is the execution unit of the portfolio. It links to the opportunity it addresses and the person who manages it. It carries the problem, proposed solution, value proposition, solution hypothesis, goals, and a measurable objective, plus results, learnings, an explicit decision (e.g. Persevere / Pivot / Stop), next steps, budget, resources, and risks. Each initiative passes through the program's lifecycle stages. An initiative may also reference a dedicated business model as a submodel via the `initiativeBusinessModel` field (`type:: model`, `target_template: business`), giving each initiative its own Business-template model for value proposition, segments, channels, and revenue.

### Methodologies

**Hypothesis-Driven Execution** — validate a stated solution hypothesis against a measurable objective before scaling.
**Decision Gates** — record an explicit Persevere / Pivot / Stop decision with justification at each milestone.

### Prompts

`Describe the initiative's solution hypothesis, measurable objective, and goals.`
`Summarize the results, learnings, and the explicit decision (Persevere / Pivot / Stop) with justification.`
`List the next steps, budget, resources, and key risks of the initiative.`
