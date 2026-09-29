# Technical Design: Three-Tier Consoles & Asynchronous Review

## 1. Technical Approach & Architecture Decisions

| Area | Decision | Rationale |
| :--- | :--- | :--- |
| **Three-Tier Hierarchy** | L1 Universal Core (`innfo-runtime.js`), L2 Domain Templates (views/tabs), L3 Model Artifacts | Decouples shared UI primitives from domain layouts and model instances. |
| **Offline Contract** | Zero-build, `file://` compatible, embedded JSON slots (`#innfo-config`, `#innfo-schema`, `#innfo-model`) | Enables double-click execution for non-technical domain stakeholders without dependencies. |
| **Authorship Pathways** | Formalize Pathway 1 (Conversational AI), Pathway 2 (Direct App GUI), and Pathway 3 (Async Console Review) | Separates knowledge authoring from asynchronous stakeholder review. |
| **Reviewer Identity** | Header chip editing `localStorage['innfo_reviewer_name']` (default: `reviewer`) | Zero-friction identity management across browser sessions without auth backends. |
| **Feedback Badges** | Reactive badge counters on Element Cards (`.innfo-card-badge`) and Concept Rail items (`.innfo-rail-badge`) | Visual cues for pending, unexported review feedback. |
| **Universal Review Tab** | `#innfo-tab-review` aggregating session notes with deep links to cards | Provides a consolidated overview before exporting review payloads. |
| **Export Filename** | `<Model>_V_<Version>_<user>_review.json` | Deterministic naming for automated ingest in Pathways 1 & 2. |

---

## 2. Data Flow

```
+-------------------------------------------------------------------------------+
|  PATHWAY 1 (Conversational AI)    /    PATHWAY 2 (Direct App GUI)             |
|  [Knowledge Architects / Leads]        [Visual Schema Modeling]               |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼ [scripts/export-console.mjs]
+-------------------------------------------------------------------------------+
|  PATHWAY 3 (Asynchronous Console Review)                                      |
|  Standalone HTML Artifact (<Model>_V_<Version>_console.html)                  |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  | Header: Model Metadata | Needs | [ Reviewer: Jane Doe ✏️ ] | [ Export ] |  |
|  +-------------------------------------------------------------------------+  |
|  | View Tabs: [ 📊 Domain View ] [ 🗂️ Explorer (🔴 2) ] [ 📝 Review (2) ]  |  |
|  +-------------------------------------------------------------------------+  |
|  | Active Review Session:                                                  |  |
|  | - Concept Rail & Element Cards with visual review badges                |  |
|  | - Universal Review Tab: Session draft aggregation + card deep linking   |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼ [Download]
                 <Model>_V_<Version>_<user>_review.json
                                      │
                                      ▼ [Ingest back to Pathway 1 / 2]
```

---

## 3. Interfaces & Contracts

### Export Filename Pattern
`<Model>_V_<Version>_<user>_review.json`
* Example: `BusinessModel_V_1-2-0_jane_doe_review.json`
* Sanitization: Model is alphanumeric; Version replaces dots with hyphens (`1.2.0` -> `1-2-0`); User is normalized via `slugify(user)`.

### Review JSON Contract
```json
{
  "$schema": "https://cognntive.dev/schemas/console-review-v1.json",
  "model": "BusinessModel",
  "version": "1-2-0",
  "reviewer": "jane_doe",
  "exportedAt": "2026-09-28T18:00:00Z",
  "summary": {
    "total": 2,
    "corrections": 1,
    "comments": 1
  },
  "items": [
    {
      "id": "fb-001",
      "elementId": "enterprise-tier",
      "concept": "RevenueStream",
      "kind": "correction",
      "field": "pricing",
      "note": "Updated seat minimum to 50",
      "status": "pending"
    }
  ]
}
```

---

## 4. File Changes

| File Path | Description of Changes |
| :--- | :--- |
| `iNNfo/specs/templates/console/innfo-runtime.js` | Implement reviewer profile chip, badge renderers, Universal Review Tab (`renderReviewTab`), and standardized filename export. |
| `iNNfo/specs/templates/console/artifact_blueprint.html` | Add review summary tab container, header reviewer profile markup, and badge styles. |
| `scripts/export-console.mjs` | Update standalone bundle injector and template hydration for 3-tier console export. |
| `iNNfo/specs/templates/console/innfo-console.bundle.js` | Rebundle runtime distribution for offline vending. |
| `test/console-review.test.mjs` | New unit/integration test suite covering review workflow, badge state, and export naming. |

---

## 5. Testing Strategy

1. **Unit Tests (`test/console-review.test.mjs`)**:
   - Reviewer identity: `localStorage` persistence, inline name editing, and fallback to `reviewer`.
   - Filename generation: Verify `<Model>_V_<Version>_<user>_review.json` sanitization across special characters.
   - Draft store: Verify item insertion, status mutation (`pending`/`applied`), and summary aggregations.
2. **DOM / Component Tests**:
   - L1 Primitives: Offline hydration of `ConceptPill`, `ElementPill`, and Concept Rail.
   - Badges: Verify badge appearance/removal on cards and rail when comments change.
   - Review Tab: Verify switching to Review Summary tab and deep links navigation.
3. **CLI Export Test (`test/console-export.test.mjs`)**:
   - Validate exported console artifacts open via `file://` and execute with zero network dependencies.

---

## 6. Migration

- **Backward Compatibility**: Existing console artifacts without `#innfo-tab-review` will have the tab injected dynamically by `innfo-runtime.js`.
- **Legacy Feedback Format**: Readers accept both legacy timestamped filenames and the new `<Model>_V_<Version>_<user>_review.json` format.
