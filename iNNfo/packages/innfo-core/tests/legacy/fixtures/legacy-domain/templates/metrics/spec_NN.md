---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Metrics App"
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
procedures:
  - id: "create-timeline"
    name: "Create Timeline"
    path: "procedures/create_timeline_NN.md"
assets:
  - id: "timeline-layout"
    name: "Timeline HTML Layout"
    path: "assets/timeline.html"
  - id: "model-data-template"
    name: "MODEL_DATA JSON Template"
    path: "assets/MODEL_DATA.template.json"
  - id: "verify-harness"
    name: "Timeline Verify Harness"
    path: "scripts/verify.harness.js"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Metrics]]
* [[Variables]]
* [[Evolution]]
* [[Scenario]]

# NN Concept Definition

## NN Concept Definition: Metrics
icon:: bar-chart-3
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Variables
icon:: settings-2
type:: list
color:: green
weight:: 80

## NN Concept Definition: Evolution
icon:: trending-up
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Scenario
icon:: layers
type:: list
color:: purple
weight:: 70

# NN Field Definition

## NN Field Definition: metricValue
concept:: Metrics
type:: string
description:: Value of the metric row (base number or computed result placeholder).

## NN Field Definition: metricFormula
concept:: Metrics
type:: string
description:: Verbatim formula text computing the value (e.g. net income - opex subtotal).

## NN Field Definition: dependsOn
concept:: Metrics
type:: reference
target_concepts:: [Metrics, Variables]
description:: Primary row feeding this metric (single WikiLink). The full fan-in graph lives in the metrics-dependencies and metric-variables matrices; the Create Timeline procedure merges both into the artifact DEPS map.

## NN Field Definition: metricType
concept:: Metrics
type:: select
options:: [result, revenue, expense, tax, investment]
description:: Category of the metric row.

## NN Field Definition: metricUnit
concept:: Metrics
type:: string
description:: Unit of the metric (currency/month, %, nights, months, etc.).

## NN Field Definition: evolution
concept:: Metrics
type:: reference
target_concepts:: [Evolution]
description:: Monthly evolution rule applied to this metric row.

## NN Field Definition: variableValue
concept:: Variables
type:: string
description:: Numeric value of the input variable (rate, occupancy %, fee, growth %).

## NN Field Definition: variableType
concept:: Variables
type:: select
options:: [rate, occupancy, fee, growth, cost, days, months, count]
description:: Classification of the variable for use in the projection sheet.

## NN Field Definition: variableUnit
concept:: Variables
type:: string
description:: Unit of the variable (currency, %, nights, months, etc.).

## NN Field Definition: evolutionType
concept:: Evolution
type:: select
options:: [fixed, compound, additive]
description:: Monthly evolution rule kind for a metric row.

## NN Field Definition: evolutionFactor
concept:: Evolution
type:: string
description:: Evolution factor: the percentage for compound or the unit delta for additive.

## NN Field Definition: scenarioMonths
concept:: Scenario
type:: string
description:: Projection horizon in months covered by this scenario.

## NN Field Definition: scenarioType
concept:: Scenario
type:: select
options:: [historical, projection]
description:: Whether the scenario consolidates measured past data, projects future data, or (when a model carries both scenarios) anchors projections on actuals.

## NN Field Definition: scenarioNotes
concept:: Scenario
type:: string
description:: Free-form notes describing the scenario assumptions.

# NN Marker Definition

## NN Marker Definition: is_variable
applies_to:: [Element]
symbol:: *
icon:: edit
color:: blue

## NN Marker Definition: is_formula
applies_to:: [Element]
symbol:: "="
icon:: calculator
color:: green

## NN Marker Definition: is_derived
applies_to:: [Element]
symbol:: "~"
icon:: sparkles
color:: purple

# NN Matrix Definition

## NN Matrix Definition: metrics-dependencies matrix
source:: Metrics
target:: Metrics
values:: [DependsOn]

## NN Matrix Definition: metric-variables matrix
source:: Metrics
target:: Variables
values:: [Uses]

## NN Matrix Definition: scenario-metrics matrix
source:: Scenario
target:: Metrics
values:: [Includes]

# Metrics Template

## A template for modeling quantified metric sets with dependency graphs, input variables, evolution rules, and projection scenarios

## Philosophy

A projection is only as trustworthy as the metric graph behind it. This template
treats every number as a node: base variables feed metric rows through declared
formulas, evolution rules project them across months, and scenarios select which
rows participate. The `Create Timeline` procedure snapshots that graph into a
standalone `Timeline` HTML artifact — data (`MODEL_DATA`), logic (`FORMULAS`),
and dependencies (`DEPS`) kept strictly separate so a model change means
re-snapshotting one JSON block, never rewriting the dashboard.

## Objectives

- Model any quantified domain (rental yield, SaaS revenue, project costs) as typed metric rows with explicit dependencies.
- Consolidate measured history and future projection in one table: `historical` scenarios anchor the sheet on actuals, `projection` scenarios extend it.
- Keep input variables, evolution rules, and scenarios as first-class concepts instead of spreadsheet folklore.
- Score rows with `is_variable` / `is_formula` / `is_derived` markers so the artifact knows what is editable, computed, or artifact-invented help.
- Generate the `Timeline` HTML dashboard deterministically via the embedded `create-timeline` procedure.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Metrics** | `list` | Quantified rows: results, revenues, expenses, taxes, investments (via `metricType`) |
| **Variables** | `list` | Editable input variables (rates, occupancies, fees, growth) |
| **Evolution** | `list` | Monthly evolution rules (fixed, compound, additive) |
| **Scenario** | `list` | Historical or projection scenarios selecting horizon and participating rows |

### Markers

| Marker | Purpose |
|---|---|
| `is_variable` | Row is user-editable input |
| `is_formula` | Row is computed from a formula |
| `is_derived` | Row is artifact-invented help, not verbatim from the model |

### Matrices

| Matrix | Source → Target | Purpose |
|---|---|---|
| metrics-dependencies | Metrics → Metrics | Which metric rows feed each computed row |
| metric-variables | Metrics → Variables | Which input variables each row consumes |
| scenario-metrics | Scenario → Metrics | Which rows participate in each scenario |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Source→target tables |
| Graph edge | ❌ | Not applicable |
| Sequence | ✅ | Enabled via evolution ordering across months |

## Template

### Level 3 Model Template (Lightweight)

To create a metrics model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "metrics_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
model_version: "V_0-1-0"
title: "<Metrics Model Title>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index

* [[Metrics]]
* [[Variables]]
* [[Evolution]]
* [[Scenario]]
```

## Examples

### Canonical Sample

The official sample for this template is at `specs/templates/metrics/samples/Ghostbusters_V_0-1-0_metrics_NN.md`. It exercises typed metric rows, input variables, evolution rules, scenarios, the three evaluable matrices, and the item-markers matrix.

### Parent Chain

```yaml
# From the Ghostbusters metrics sample:
parent_spec:
  name: "metrics_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"

# This template's parent:
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
```

# Concept Guidance Documentation

## Metrics

### Summary

A quantified row of the model: either an editable input, a computed result, or artifact-derived help.

### Description

Each Metrics element carries its value, its verbatim formula text, the rows it
depends on (`dependsOn`), its category (`metricType`), its unit, and its monthly
evolution rule. Computed rows reference their inputs; the Create Timeline
procedure mirrors those references into the artifact DEPS map.

### Methodologies

**Dependency mapping** — every computed row must declare all rows feeding it; undeclared inputs are a modeling error.

### Prompts

`List every metric row with its type, unit, formula, and dependencies.`
`Which rows are editable inputs and which are computed?`

## Variables

### Summary

Editable input variables consumed by metric rows.

### Description

Base numbers the user can change in the artifact (rates, occupancies, fees,
growth). Each variable declares its type and unit. Variables never depend on
other rows — they are the leaves of the dependency graph.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## Evolution

### Summary

Monthly evolution rules applied to metric rows.

### Description

How a row value moves month over month: fixed (constant), compound (percentage
growth applied monthly), or additive (fixed unit delta added monthly), with the
corresponding factor.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## Scenario

### Summary

A historical or projection scenario selecting horizon and participating rows.

### Description

Named scenarios (e.g. short-stay, monthly, hybrid) with a month horizon,
a `scenarioType` (`historical` for measured past data, `projection` for
future data), and notes on assumptions. The scenario-metrics matrix declares
which metric rows each scenario includes. Historical rows carry verbatim
`history` values in the artifact MODEL_DATA; the dashboard renders them
distinctly from computed months.

NOTE — V_0-1-0 scope: the artifact renders one neutral flow (actuals +
projection). Scenario variants (optimistic/pessimistic) are modeled as
ordinary variant rows through Metrics/Variables; side-by-side comparison
is backlog (`feature/metrics-scenario-compare`).

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## is_variable

### Summary

Description of is_variable.

### Description

Description of is_variable.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## is_formula

### Summary

Description of is_formula.

### Description

Description of is_formula.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## is_derived

### Summary

Description of is_derived.

### Description

Description of is_derived.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## metrics-dependencies matrix

### Summary

Description of metrics-dependencies matrix.

### Description

Description of metrics-dependencies matrix.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## metric-variables matrix

### Summary

Description of metric-variables matrix.

### Description

Description of metric-variables matrix.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## scenario-metrics matrix

### Summary

Description of scenario-metrics matrix.

### Description

Description of scenario-metrics matrix.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*

## item-markers matrix

### Summary

Description of item-markers matrix.

### Description

Description of item-markers matrix.

### Methodologies

*No methodologies provided.*

### Prompts

*No prompts provided.*
