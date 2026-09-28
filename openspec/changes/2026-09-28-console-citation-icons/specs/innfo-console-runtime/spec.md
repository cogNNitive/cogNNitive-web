# Delta for innfo-console-runtime

## MODIFIED Requirements

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

## ADDED Requirements

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
