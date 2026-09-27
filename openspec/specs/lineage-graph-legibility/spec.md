# Lineage Graph Legibility Specification

## Purpose

Render the editor's lineage Mermaid graph at natural size instead of shrinking it to fit a fixed viewport, and keep the graph navigable by collapsing the outgoing-relationships level by default.

## Requirements

### Requirement: Mermaid renders at natural size, top-down

The lineage graph MUST render with Mermaid's `flowchart.useMaxWidth` set to `false` and MUST use `graph TD` (top-down) layout. The containing modal MUST scroll (horizontally and/or vertically) rather than shrink the rendered graph to fit the viewport.

#### Scenario: Wide graph does not shrink

- GIVEN a lineage graph wider than the modal's viewport
- WHEN the graph is rendered
- THEN the graph renders at its natural size
- AND the modal shows a scrollbar instead of scaling the graph down

#### Scenario: Layout direction is top-down

- GIVEN any lineage graph
- WHEN the Mermaid definition is generated
- THEN it declares `graph TD`

### Requirement: 4th-level outgoing relationships collapse by default

The lineage graph MUST support a 4th nesting level of outgoing relationships (relationships whose source is already 3 levels deep from the root). This 4th level MUST be collapsed by default behind a toggle. While collapsed, the graph MUST display a count of the hidden nodes/edges as `+N hidden`. Activating the toggle MUST expand the 4th level and reveal the previously hidden nodes/edges.

#### Scenario: 4th level collapsed by default

- GIVEN a lineage graph whose outgoing relationships reach a 4th level with 5 hidden nodes
- WHEN the graph first renders
- THEN the 4th level is not rendered
- AND the toggle shows `+5 hidden`

#### Scenario: Toggle expands the collapsed level

- GIVEN a collapsed 4th level showing `+5 hidden`
- WHEN the user activates the toggle
- THEN the 4th level's nodes and edges render
- AND the hidden count is no longer shown

#### Scenario: No 4th level means no toggle

- GIVEN a lineage graph whose deepest outgoing relationship chain is 3 levels
- WHEN the graph renders
- THEN no collapse toggle is shown
