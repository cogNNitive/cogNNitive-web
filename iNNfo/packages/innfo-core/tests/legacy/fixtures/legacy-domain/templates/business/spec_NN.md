---
spec_version: "V_0-2-5"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-5"
title: "Business App"
includes:
  - name: "business-model"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business-model/spec_NN.md"
  - name: "analysis"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
  - name: "organization"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
  - name: "metrics"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: index block
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
procedures:
  - id: "compile-model-viewer"
    name: "Compile Model Viewer"
    path: "procedures/compile_model_viewer_NN.md"
assets:
  - id: "model-viewer-shell"
    name: "Model Viewer HTML Layout"
    path: "assets/model_viewer.html"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Matrix Definition

## NN Matrix Definition: Metrics-Organizational goals Matrix
source:: Metrics
target:: Organizational goals
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set
description:: Scores how directly each Metric tracks each Organizational goal.

# Business Template

## The complete business-modeling template — the descriptive model core plus its analysis layer, reusing the shared organization and projects vocabularies

## Philosophy

A comprehensive business model is more than a description of a venture. It is that
description **plus** the evaluative work that keeps it honest — the assumptions it
rests on, the risks it runs, the coherence of its parts, the experiments that turn
belief into evidence — **plus** the reusable vocabularies for how people are
organized and how initiatives are planned and delivered.

This template is a **near-pure composite**. Almost its entire schema is the additive union of the
templates it `includes`. It declares exactly one Matrix Definition of its own —
`Metrics-Organizational goals Matrix` — because that relationship spans two
included templates (`metrics` rows × `business-model` goals) and therefore
belongs to neither ingredient alone:

- **`business-model`** — the descriptive core: market, value propositions,
  solutions, marketing, team narrative, business idea and objectives, operations,
  finance, legal, and the cross-cutting `Procedure` and `Misc` concepts. It in
  turn `includes` `organization` and `projects`, so their concepts arrive here
  transitively.
- **`analysis`** — the strategic-review layer: `Analysis` (Assumptions, Risks,
  SWOT, Keys, Suggestions) and `Validation` (Coherence, Experiments), with the
  Assumptions-Risks and Experiments-Assumptions matrices.
- **`organization`** (via `business-model`) — `Organization`, `Roles`,
  `Functions`, `Position`, `Person`, `Skills`, plus the positions-roles,
  persons-positions, and Functions-Positions matrices and the `complexity` marker.
- **`projects`** (via `business-model`) — `Project`, `Phases`, `Milestone`,
  `Deliverable`, `Task`, `Risk`, `Project roles`, plus the task-roles,
  task-deliverables, and risks-milestones matrices and the `health` marker.
- **`metrics`** — the quantified layer: `Metrics` (typed rows with formulas and
  dependencies), `Variables`, `Evolution`, `Scenario`, with the
  metrics-dependencies, metric-variables, and scenario-metrics matrices and the
  `is_variable` / `is_formula` / `is_derived` markers. Its `Create Projections`
  procedure compiles any metrics model into a standalone Projections dashboard.

`business-model` and `analysis` each declare the same five markers — `importance`,
`completion`, `certainty`, `priority`, `rating` — with **identical bodies**. Under
iNNfo's additive-composition rule, two sources declaring a Definition whose
canonical form is identical merge silently into one entry; declaring them
differently would be a composition ERROR. That shared five-marker set is the
business vocabulary, kept in sync across the two halves.

## Objectives

1. Give business-model authors one `parent_spec` that resolves the full descriptive + analytical + organizational + project vocabulary.
2. Keep the descriptive core (`business-model`) and the review layer (`analysis`) independently reusable and independently versioned.
3. Reuse `organization` and `projects` rather than duplicating human-structure and project-planning concepts.
4. Attach the quantified layer (`metrics`) so revenue, cost, and projection rows live in the same model as the narrative — with goal tracking (`Metrics-Organizational goals`) declared on the composite, where both endpoints meet.
5. Compose without collisions — every shared Definition is declared identically across sources.

## Specification

This template declares one Matrix Definition of its own and resolves the rest
from its included templates' Definitions:

| Contributed by | Concepts | Markers | Matrices |
|---|---|---|---|
| `business-model` | Business summary, Market, Stakeholders, Segments, Profiles, Persona, Segmentation, Market trends, Market size, Competition, Problems, Value propositions, Messages, Channels, Perceptions, Emotions, Behaviors, Journey, Solutions, Offerings, Products and services, Features, Components, Roadmap, Marketing, Branding, Media plan, Communication, Pitch, Web, Storytelling, Presentations, Team, Business idea, Inspiration, Opportunity, Business objectives, Mission, Vision, Organizational values, Organizational goals, Operations, Activities, Resources, Finance, Revenue, Costs, Unit economics, Funding sources, Shareholders, Projections, Legal, Legal issues, Contracts, Challenges, Unfair advantage, Goals, Misc, Procedure | importance, completion, certainty, priority, rating | Journey map, Segmentation-Profiles, Problems-Value propositions, Value propositions-Messages, Messages-Channels, Features-Milestone, Organizational values-Organizational goals, Activities-Resources, Problems-Competition |
| `analysis` | Analysis, Assumptions, Risks, Suggestions, SWOT, Keys, Validation, Coherence, Experiments | importance, completion, certainty, priority, rating *(identical → merged)* | Assumptions-Risks, Experiments-Assumptions |
| `organization` (transitive) | Organization, Roles, Functions, Position, Person, Skills | complexity | positions-roles, persons-positions, Functions-Positions |
| `projects` (transitive) | Project, Phases, Milestone, Deliverable, Task, Risk, Project roles | health | task-roles, task-deliverables, risks-milestones |
| `metrics` | Metrics, Variables, Evolution, Scenario | is_variable, is_formula, is_derived | metrics-dependencies, metric-variables, scenario-metrics |
| `business` (own) | — | — | Metrics-Organizational goals |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Source→target tables |
| Graph edge | ❌ | Not applicable |
| Sequence | ✅ | concept type `steps` / `sequence` (`Journey`, `Roadmap`, `Phases`) |

## Template

### Level 3 Model Template (Lightweight)

To create a business model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "business_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md"
model_version: "V_x-y-z"
title: "<Your Business Name>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN Business summary
Your business summary here.

# NN Stakeholders
## NN Stakeholders: Stakeholder Name
relationship_model:: Dedicated
Description and details.

# NN matrices: problems-value propositions matrix
| Problems \ Value propositions | VP1 | VP2 |
| :--- | :---: | :---: |
| Problem 1 | Max | High |
```

The application resolves the `parent` URL, downloads this template, follows its
`includes` (and their transitive `includes`), and unions every resolved
Concept / Field / Marker / Matrix Definition to validate and render the model.

## Examples

### Canonical Sample

The official sample for this template is
`specs/templates/business/samples/Ghostbusters_V_0-2-3_business_NN.md` — the
`V_0-2-1` Ghostbusters sample re-pointed at this version.
`Ghostbusters_V_0-2-1_business_NN.md` is kept for consumers still pinned to
`V_0-2-1`. `V_0-2-1` added the `Compile Strategic Master` procedure; `V_0-2-2`
added `Compile Model Viewer` (`procedures/compile_model_viewer_NN.md`), which
fills the template-agnostic consultation shell at `assets/model_viewer.html`
with the resolved schema and serialized model data — a single offline,
read-only page for browsing any model built on this template. `V_0-2-3` is a
docs-and-sample patch that finalizes that work. `V_0-2-4` attaches the `metrics`
template (quantified rows, variables, scenarios, `Create Projections`
procedure) and moves the `Metrics-Organizational goals` matrix onto the
composite, where both endpoints meet. The `V_0-2-3` Ghostbusters sample is
kept as the canonical sample: its prose-only `Metrics` elements and its
`metrics-organizational goals` block resolve unchanged against the new
composition.

## Parent Chain

```yaml
# From the Ghostbusters V_0-2-3 sample:
parent_spec:
  name: "business_V_0-2-3"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md"

# This template's parent:
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"

# This template's includes:
includes:
  - name: "business-model"   # → includes organization, projects
  - name: "analysis"
  - name: "metrics"
```
