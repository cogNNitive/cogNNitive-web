# Review Workflow Specification

## Purpose

Defines the asynchronous review workflow, including reviewer identity, visual feedback badges, universal review summary, and standardized feedback artifact export.

## Requirements

### Requirement: Reviewer Identity Profile Chip

Consoles MUST display a reviewer profile chip in the top-right header. The reviewer name MUST be editable on click and persisted in `localStorage`. If unset, it MUST default to `reviewer`.

#### Scenario: Reviewer name persistence
- GIVEN a user updates their reviewer name in the chip
- WHEN the page reloads or another console opens
- THEN the chip displays the persisted reviewer name

### Requirement: Card and Rail Review Badges

Elements and Concept Rail items containing active review notes MUST display a visual review badge indicating unexported feedback.

#### Scenario: Visual badge on commented element
- GIVEN an element card with draft comments
- WHEN the console renders the rail and card list
- THEN a review badge displays on the element card and its rail item

### Requirement: Universal Review Summary Tab

Every console MUST provide a standardized "Review Summary" tab aggregating session notes, showing pending item counts, and enabling card navigation.

#### Scenario: Aggregating session feedback
- GIVEN draft annotations across multiple elements
- WHEN the user opens the "Review Summary" tab
- THEN comments are grouped by element with direct links to each card

### Requirement: Standardized Review JSON Export

Consoles MUST provide an export button downloading feedback as JSON named `<Model>_V_<Version>_<user>_review.json`, sanitizing spaces and special characters.

#### Scenario: Exporting review JSON
- GIVEN model `BusinessModel`, version `1.2.0`, and user `Jane Doe`
- WHEN the user clicks export feedback
- THEN `BusinessModel_V_1.2.0_jane_doe_review.json` downloads containing structured feedback
