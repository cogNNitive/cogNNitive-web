# cogNNitive Deliverable Review & Feedback Guide

## Overview

Deliverables produced within the **cogNNitive** ecosystem (such as Business Plans, Technical Specifications, and Operating Procedures) are compiled directly from structured **iNNfo** domain models and verified evidence sources.

To enable bidirectional synchronization—allowing human feedback to be absorbed back into domain models without corrupting business truth or losing provenance—cogNNitive implements the **Dual-Emission and 4-Layer Reconciliation Protocol**.

---

## 1. The Dual-Emission Deliverable Pattern

When an artifact generator runs, it emits two paired files:

| Artifact Type | Filename Pattern | Purpose |
|---|---|---|
| **Clean Published Output** | `{Stem}_V_{Version}.docx` | The final, unencumbered publication deliverable for stakeholders. |
| **Review Scaffold** | `{Stem}_V_{Version}_reviewer_review.docx` | The review copy containing embedded guidance for the human reviewer. |

---

## 2. Reviewer Instructions (3-Step Protocol)

When reviewing a cogNNitive deliverable:

### Step 1: Set Your Reviewer Identity in the Filename
Replace the `reviewer` token with your name or username before starting your review:
- **Template:** `Acme_Lean_Business_Plan_V_0-2-0_reviewer_review.docx`
- **Your file:** `Acme_Lean_Business_Plan_V_0-2-0_architect_review.docx`

### Step 2: Enable Track Changes
Enable Word's native Track Changes (*Review → Track Changes*) for any inline textual, structural, or numerical edits.

### Step 3: Use Semantic Prefixes in Comments
When inserting Word comments (*Review → New Comment*), prepend one of the four standard semantic tags to indicate your intent:

- `[DECISION]` — **Domain / Business Rule Change**: Indicates that a strategic premise, model element, or business reality has changed.
  > *Example:* `[DECISION] We are discarding the secondary facility expansion in favor of regional partnerships.`
- `[SCOPE]` or `[FORMAT]` — **Deliverable Scope Trimming**: Indicates that content should be omitted from this specific deliverable without invalidating the upstream model.
  > *Example:* `[SCOPE] Move the detailed financial model tables to an external annex.`
- `[DATA]` — **Metric or Numerical Correction**: Specific updates to numbers or figures coming from satellite data sheets.
  > *Example:* `[DATA] Updated initial investment cap to 180,000 EUR.`
- `[QUESTION]` — **Open Inquiry**: Questions requiring clarification from the domain modeling team.
  > *Example:* `[QUESTION] Has the municipal operating permit timeline been confirmed?`

---

## 3. Automated Reconciliation Pipeline

When the reviewed document is deposited into the workspace `artifacts/` folder, the AI Architect runs `reconcile_artifact_feedback_NN.md`:

```mermaid
flowchart LR
    A[Reviewed Document .docx] --> B[Forensic Extraction Pandoc + XML]
    B --> C[4-Layer Triaging Engine]
    C --> D{Semantic Tag Present?}
    D -->|Yes: [DECISION]| E[Deterministic Model Mutation via MCP]
    D -->|Yes: [SCOPE]| F[Update Generator Template]
    D -->|No: Direct Edit| G[Interactive Human Intent Gate]
    G --> E
    E --> H[Sanitize Final Artifact & Register Lineage]
```

1. **Forensic Extraction**: Parses the filename for `reviewer_slug`, extracts Word comments (`comments.xml`), Track Changes (`<w:ins>`, `<w:del>`), and media counts.
2. **4-Layer Triaging**: Separates deliverable formatting from domain truth, satellite spreadsheet data, and reviewer drafting defects.
3. **Upstream Mutation**: Updates the Level 3 iNNfo domain model via `innfo-mcp`, re-validates schemas deterministically, and updates workspace lineage records (`workspace_NN.md`).
4. **Sanitization & Publication**: Fixes any drafting artifacts (e.g. truncated sentences), recompiles the clean published deliverable, and registers the review history.
