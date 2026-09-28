# Tasks: Three-Tier Consoles & Asynchronous Review

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 total |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

---

## Phase 1: Runtime Primitives & UI Tokens

- [x] 1.1 **Reviewer Profile Chip**: Implement reviewer identity component in `iNNfo/specs/templates/console/innfo-runtime.js` header rendering, reading/writing `localStorage['innfo_reviewer_name']` with default fallback to `'reviewer'` and inline click-to-edit support. `[review-workflow:Requirement:Reviewer Identity Profile Chip]`
- [x] 1.2 **Visual Review Badges**: Implement `.innfo-card-badge` on Element Cards and `.innfo-rail-badge` on Concept Rail navigation items in `innfo-runtime.js` reflecting active unexported draft note counts. `[review-workflow:Requirement:Card and Rail Review Badges]`
- [x] 1.3 **Offline Contract & Primitive Hydration**: Ensure Level 1 universal runtime primitives (`ConceptPill`, `ElementPill` with origin citation icons, Concept Rail, Element Card, Matrix) operate with zero-build and offline `file://` compatibility via JSON slot embedding. `[console-architecture:Requirement:Level 1 Universal Runtime Primitives]`
- [x] 1.4 **Blueprint & Layout Markup**: Update `iNNfo/specs/templates/console/artifact_blueprint.html` with header reviewer profile container, tab shell `#innfo-tab-review`, and CSS styles for badge counters and reviewer chips. `[console-architecture:Requirement:Level 2 Template Domain Consoles]`

## Phase 2: Review Tab & Workflow

- [x] 2.1 **Universal Review Summary Tab**: Implement `renderReviewTab(doc, state, config)` in `iNNfo/specs/templates/console/innfo-runtime.js` aggregating session notes, pending item counters, and category breakdowns (corrections vs comments). `[review-workflow:Requirement:Universal Review Summary Tab]`
- [x] 2.2 **Card Navigation & Deep Linking**: Wire interactive links within the Review Summary tab to focus and highlight corresponding Element Cards across explorer and domain views. `[review-workflow:Requirement:Universal Review Summary Tab]`
- [x] 2.3 **Session Draft State Management**: Implement draft note store operations (`addComment`, `updateStatus`, `removeComment`, `getSummary`) matching the `console-review-v1.json` item schema. `[review-workflow:Requirement:Universal Review Summary Tab]`
- [x] 2.4 **Dynamic Review Tab Injection**: Ensure runtime dynamically injects the Review tab button and panel container when hydrating legacy console templates lacking explicit markup. `[console-architecture:Requirement:Level 2 Template Domain Consoles]`

## Phase 3: Export & Filename Standard

- [x] 3.1 **Standardized Filename Generator**: Implement export filename helper generating `<Model>_V_<Version>_<user>_review.json` with dot-to-hyphen version conversion (`1.2.0` -> `1-2-0`) and reviewer slugification. `[review-workflow:Requirement:Standardized Review JSON Export]`
- [x] 3.2 **Review JSON Payload Serialization**: Implement structured JSON serializer complying with `https://cognntive.dev/schemas/console-review-v1.json` including model metadata, reviewer name, ISO timestamp, summary counts, and items array. `[review-workflow:Requirement:Standardized Review JSON Export]`
- [x] 3.3 **Browser Export Trigger**: Wire export button in console header and Review tab to generate and trigger client-side file download without server dependencies. `[review-workflow:Requirement:Standardized Review JSON Export]`
- [x] 3.4 **CLI Export & Standalone Hydration**: Update `scripts/export-console.mjs` to support 3-tier console export and verify standalone bundle hydration. `[console-architecture:Requirement:Level 3 Model Custom Consoles]`

## Phase 4: Verification & Test Suite

- [x] 4.1 **Unit Tests - Identity & Filename (`test/console-review.test.mjs`)**: Create tests for reviewer identity persistence in `localStorage`, default fallback, and deterministic `<Model>_V_<Version>_<user>_review.json` filename sanitization. `[review-workflow:Requirement:Reviewer Identity Profile Chip]`
- [x] 4.2 **Unit Tests - Draft Store & JSON Contract**: Test draft feedback lifecycle, aggregation counters, and schema validation against `console-review-v1.json`. `[review-workflow:Requirement:Standardized Review JSON Export]`
- [x] 4.3 **DOM Component Tests**: Verify visual badge updates on cards/rails, tab switching to Review Summary tab, and deep-link click navigation. `[review-workflow:Requirement:Card and Rail Review Badges]`
- [x] 4.4 **CLI Export & Offline Verification (`test/console-export.test.mjs`)**: Validate exported HTML artifacts open cleanly under `file://` protocol with zero network dependencies. `[console-architecture:Requirement:Level 1 Universal Runtime Primitives]`

## Phase 5: Documentation & Canonical Assets Sync

- [x] 5.1 **Runtime Bundle Build**: Rebuild `iNNfo/specs/templates/console/innfo-console.bundle.js` via `scripts/build-console-bundle.mjs` to distribute updated runtime primitives. `[console-architecture:Requirement:Level 1 Universal Runtime Primitives]`
- [x] 5.2 **Canonical Sample Consoles Sync**: Regenerate and verify sample console artifacts across domain templates (`metrics`, `innovation`, `organization`, `projects`). `[console-architecture:Requirement:Level 2 Template Domain Consoles]`
- [x] 5.3 **Three-Pathway Authorship Documentation**: Document the formal Three-Pathway Authorship (Conversational AI, Direct App GUI, Asynchronous Console Review) in template guide and console architecture docs. `[console-architecture:Requirement:Three-Pathway Authorship and Review]`
