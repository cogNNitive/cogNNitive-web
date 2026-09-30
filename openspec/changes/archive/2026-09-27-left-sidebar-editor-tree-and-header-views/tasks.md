# Tasks: Left Sidebar Editor Tree and Header View Controls

Delivery Strategy: `single-pr`

Legend: `[spec]` = requirement/scenario this task satisfies, from
`openspec/changes/2026-09-27-left-sidebar-editor-tree-and-header-views/specs/editor-navigation/spec.md`.

---

## Batch 1: Store & Selection Reactivity (TDD)

- [x] 1.1 Extend `tests/unit/uiStore-selectNode.test.ts` with test cases verifying that `uiStore.selectNode()` resets `activeView` to `'editor'` from all non-editor views (`graph`, `consoles`, `matrices`, `info`, `ai-guide`), and preserves `activeView = 'editor'` when already active.
      `[spec: editor-navigation → "Tree Node Selection Reactivity Across Workspace Views" → Scenario: Selecting a concept while viewing the Graph, Scenario: Selecting an element while viewing the Consoles, Scenario: Selecting a node while already in Editor view]`
- [x] 1.2 Update `iNNfo/apps/innfo-editor/src/stores/uiStore.ts` in `selectNode(id)` to check `if (activeView.value !== 'editor') activeView.value = 'editor'`, ensuring centralized view reset on any node selection.
      `[spec: editor-navigation → "Tree Node Selection Reactivity Across Workspace Views"]`
- [x] 1.3 Run `pnpm --filter innfo-editor test:run tests/unit/uiStore-selectNode.test.ts` to confirm all store selection reactivity unit tests pass.

---

## Batch 2: Component Controls & Layout Migration

- [x] 2.1 Update `iNNfo/apps/innfo-editor/src/components/layout/Header.vue`:
      - Import `FileText`, `LayoutDashboard`, and `Layers` icons from `lucide-vue-next`.
      - Add the segmented workspace view switcher (`header-view-switcher`) containing buttons for `editor` (`header-view-editor`), `graph` (`header-view-graph`), and `consoles` (`header-view-consoles`) with dynamic active state styling and tooltips when `hasRootNode` is true.
      `[spec: editor-navigation → "Workspace View Controls in Header" → Scenario: Navigating to Graph view from Header, Scenario: Navigating to Consoles view from Header, Scenario: Header visual state indicates active view]`
- [x] 2.2 Update `iNNfo/apps/innfo-editor/src/components/layout/LeftSidebar.vue`:
      - Remove the 3-tab view switcher block (`<!-- Navigation Switcher (Horizontal) -->` containing buttons for `editor`, `graph`, `consoles`).
      - Clean up unused icon imports and retain the model/concept tree hierarchy and breadcrumbs permanently.
      `[spec: editor-navigation → "Sidebar Dedicated to Model and Concept Tree Navigation" → Scenario: Left sidebar displays concept tree without view switcher tabs, Scenario: Tree remains accessible across different workspace views]`
- [x] 2.3 Refactor `iNNfo/apps/innfo-editor/src/views/WorkspaceView.vue`:
      - Ensure node selection handlers delegate cleanly to `uiStore.selectNode` without redundant view switching logic.
      `[spec: editor-navigation → "Tree Node Selection Reactivity Across Workspace Views"]`

---

## Batch 3: Component Tests & Verification Gate

- [x] 3.1 Create component test `iNNfo/apps/innfo-editor/tests/component/Header.test.ts`:
      - Assert that `header-view-switcher` renders when a root node is loaded.
      - Assert that clicking `header-view-graph`, `header-view-consoles`, and `header-view-editor` updates `uiStore.activeView` to the respective view.
      - Assert that the active button receives proper visual styling.
      `[spec: editor-navigation → "Workspace View Controls in Header"]`
- [x] 3.2 Create or update component test `iNNfo/apps/innfo-editor/tests/component/LeftSidebar-navigation.test.ts`:
      - Assert that `view-switcher-editor`, `view-switcher-graph`, and `view-switcher-consoles` elements do not exist in `LeftSidebar`.
      - Assert that the concept/model tree is permanently rendered.
      `[spec: editor-navigation → "Sidebar Dedicated to Model and Concept Tree Navigation"]`
- [x] 3.3 Run full test suite: `pnpm --filter innfo-editor test:run` and verify zero regressions.
- [x] 3.4 Build check: `pnpm --filter innfo-editor build` to verify type checking and bundle generation.

---

## Review Workload Forecast

- **Chained PRs recommended**: No. This change is small, self-contained, and follows a `single-pr` delivery strategy.
- **400-line budget risk**: Low. The total modified lines across `LeftSidebar.vue`, `Header.vue`, `uiStore.ts`, `WorkspaceView.vue`, and new/updated test files are estimated around ~150 lines.
- **Decisions needed before apply**: None. All architectural decisions (relocating controls to Header, centralizing view resets in `uiStore.selectNode`) have been decided and documented in `proposal.md` and `design.md`.
