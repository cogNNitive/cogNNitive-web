# innfo-console-runtime Specification

## Purpose

One shared versioned runtime (`innfo-runtime.js`) plus a thin blueprint shell (`artifact_blueprint.html`) for all HTML console artifacts. Eliminates inline runtime duplication across template assets while preserving `file://` double-click with zero build.

## Requirements

### Requirement: Shared UMD/IIFE Runtime

The system MUST ship a single versioned `innfo-runtime.js` as a UMD/IIFE global (`window.InnfoConsole`). The runtime MUST NOT use `fetch()` and MUST NOT use `type=module`. It MUST be hosted on GitHub Pages and jsDelivr, with a vendored local fallback for offline use.

#### Scenario: Offline file:// open

- GIVEN a generated console referencing the runtime
- WHEN opened via `file://` double-click with no network
- THEN the console renders fully from the local fallback

#### Scenario: No module primitives in runtime

- GIVEN the published `innfo-runtime.js`
- WHEN scanned for `fetch(` and `type=module`
- THEN neither token appears

### Requirement: Blueprint Shell with Config and JSON Slots

`artifact_blueprint.html` MUST declare an `innfo-config` block with a `needs[]` capability list and exactly two JSON slots: `innfo-schema` and `innfo-model`. Generated consoles MUST declare only `needs[]` plus slot payloads and MUST NOT inline runtime code.

#### Scenario: Thin console renders from slots

- GIVEN a console with `needs: ["feedback-export"]` and populated slots
- WHEN opened via `file://`
- THEN the runtime hydrates the view and gates features absent from `needs[]`

#### Scenario: Undeclared capability stays dormant

- GIVEN a console whose `needs[]` omits `feedback-export`
- WHEN the runtime boots
- THEN export UI is not rendered

### Requirement: No Duplicated Inline Runtime

The reference assets (`business/assets/model_viewer.html`, `workspace/assets/model_console.html`, `metrics/assets/timeline.html`) MUST thin onto the blueprint. No console artifact SHALL ship duplicated inline runtime. `workspace/assets/model_console.html` MUST render the origin-typed citation icons and the citation detail dialog defined by the `console-field-citations` capability. `business/assets/model_viewer.html` MUST remain unchanged and reachable from `main` for one release cycle after `workspace/assets/model_console.html` ships, because installed procedures fetch it by that path.
(Previously: only two reference assets existed — `business/assets/model_viewer.html` and `metrics/assets/timeline.html` — with no citation rendering and no relocation constraint.)

#### Scenario: Reference assets thinned

- GIVEN the three reference assets after this change
- WHEN scanned for inline runtime markers
- THEN no duplicated runtime block is found

#### Scenario: New workspace-level asset renders citations

- GIVEN a compiled model with `el.citations` populated
- WHEN `workspace/assets/model_console.html` renders that element
- THEN an origin-typed icon is shown per the `console-field-citations` rules

#### Scenario: Old business shell still resolves during the transition cycle

- GIVEN an installed procedure referencing `business/assets/model_viewer.html` by its pre-existing path
- WHEN that procedure runs during the one-cycle transition window
- THEN the fetch succeeds because the file has not been removed or moved

### Requirement: Exclude Internal Specs and Workspace Root from Model Console Tabs

`ConsoleHubView` MUST filter `modelStore.rootIds` so that only level-3 domain models appear as switchable model console tabs. It MUST NOT render tabs for internal schema/spec nodes (`spec:*`, `template:*`) or the workspace manifest root node (whose console is accessed via the dedicated "Workspace Hub" tab).

#### Scenario: Internal spec node excluded from console tabs

- GIVEN a workspace containing resolved spec roots such as `spec:workspace` or `spec:business`
- WHEN `ConsoleHubView` evaluates `discoveredModels`
- THEN no tab is rendered for `spec:workspace` or `spec:business`

#### Scenario: Workspace manifest root excluded from model console tabs

- GIVEN a workspace containing a root node with `type: 'workspace'`, template `workspace`, or source `workspace_NN.md`
- WHEN `ConsoleHubView` evaluates `discoveredModels`
- THEN no separate model tab is rendered for the workspace root manifest
- AND the "Workspace Hub" tab provides the single canonical entrypoint for workspace aggregation deliverables

#### Scenario: Domain model tabs rendered correctly

- GIVEN a workspace containing domain model roots (e.g. `business`, `metrics`, `innovation`)
- WHEN `ConsoleHubView` evaluates `discoveredModels`
- THEN a tab is rendered for each concrete domain model allowing the user to view its compiled console

### Requirement: Console compile procedure relocated to workspace level

The compile procedure file MUST move from `business/procedures/compile_model_viewer_NN.md` to `workspace/procedures/compile_model_console_NN.md`. This relocation MUST be accompanied by: updating the `business/spec_NN.md` frontmatter and history prose to drop the moved procedure reference, updating the business mirror in `canonical-registry.ts`, bumping both the source `template_version` and the `SHIPPED_TEMPLATE_VERSIONS` registration, rebuilding `innfo-console.bundle.js` with a new `innfo-console-v*` pin, and cutting a new `templates-v*` tag with a re-pin. No reference to the old `business/procedures/compile_model_viewer_NN.md` path MUST remain anywhere in the codebase after the relocation lands.

#### Scenario: Procedure moved and registered

- GIVEN the relocation commit has landed
- WHEN `workspace/procedures/compile_model_console_NN.md` is resolved as a template procedure
- THEN it is found under `workspace/procedures/`, registered in `canonical-registry.ts`, and its `template_version` is present in `SHIPPED_TEMPLATE_VERSIONS`

#### Scenario: No dangling references to the old procedure path

- GIVEN the relocation commit has landed
- WHEN `check:integrity` and `validate-manifest` run
- THEN neither reports a reference to `business/procedures/compile_model_viewer_NN.md`
- AND both checks pass
