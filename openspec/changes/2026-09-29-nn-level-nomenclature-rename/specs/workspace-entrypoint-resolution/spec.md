## MODIFIED Requirements

### Requirement: Multi-Store Spec Template Precedence and Resolution

When resolving Level 2 bluepriNNts referenced in a domaiNN entrypoint (e.g. the `domaiNN` bluepriNNt, `parent_spec::`, or explicit blueprint declarations), `innfo-core` MUST search candidate locations in strict precedence order:
1. Domain-local blueprints directory (`./specs/bluepriNNts/<name>/<version>/`)
2. Global user agents directory (`~/.agents/bluepriNNts/`)
3. Installed skill bundled-blueprint directories (`~/.agents/skills/*/<bundled-blueprints-dir>/`, the directory named by the `bundled_blueprints` key)

The parser MUST resolve and load the first matching bluepriNNt found in this precedence order. The resolver tiers cover the new layout only; the former `./templates/` and `~/.agents/templates/` locations MUST NOT be searched. The frozen `workspace_spec_NN.md` and `workspace_V_0-3-0_spec_NN.md` MUST NOT be resolved as distribution targets for new documents; a document that names them as `parent_spec` MUST be reported legacy.

#### Scenario: bluepriNNt resolved from local domain directory
- GIVEN a domaiNN containing `./specs/bluepriNNts/domaiNN/V_0-1-0/spec_NN.md`
- AND a global copy also exists
- WHEN `innfo-core` resolves the `domaiNN` bluepriNNt
- THEN the local file is loaded
- AND global or skill-bundled copies are ignored

#### Scenario: Fallback resolution to global user cache
- GIVEN a domaiNN without a local copy of `domaiNN` `V_0-1-0`
- AND the global cache holds it
- WHEN `innfo-core` resolves it
- THEN the global copy is loaded

#### Scenario: Fallback resolution to skill-bundled bluepriNNts
- GIVEN a domaiNN lacking local and global copies of `projects` `V_0-1-0`
- AND an installed skill bundles it
- WHEN `innfo-core` resolves it
- THEN it is loaded from the skill path

#### Scenario: Legacy locations are not searched
- GIVEN a bluepriNNt present only in `./templates/`
- WHEN `innfo-core` resolves it
- THEN it is not found
- AND the domaiNN is reported legacy

### Requirement: Taxonomy Metamodel Validation and Unresolved Diagnostic Reporting

`innfo-core` taxonomy validators MUST evaluate domaiNN entrypoint concept primitives (`domaiNN`, `kNNowledge`, `Folder`, `Asset`) and validation rules against the resolved Level 2 bluepriNNt regardless of its source location. If a declared bluepriNNt cannot be located in any search path, `innfo-core` MUST raise a structured resolution error detailing all checked paths.

#### Scenario: Metamodel concepts validate against resolved skill-bundled bluepriNNt
- GIVEN an entrypoint referencing `parent_spec:: projects_V_0-1-0_NN.md`
- AND the bluepriNNt is resolved from an installed skill directory
- WHEN taxonomy validation executes on the graph
- THEN concepts and properties declared by it are validated

#### Scenario: Unresolved bluepriNNt reports full path search diagnostics
- GIVEN an entrypoint referencing `parent_spec:: non_existent_spec_NN.md`
- AND it does not exist in any checked location
- WHEN `innfo-core` executes resolution
- THEN parsing fails with an unresolved-bluepriNNt error
- AND the error message enumerates all checked search paths

### Requirement: MCP Template Discovery and Workspace Hydration Tools

`innfo-mcp` MUST expose the tools `list_blueprints` and `hydrate_blueprint` to list available Level 2 bluepriNNts across all resolution stores and hydrate selected bluepriNNts into an active domaiNN's local blueprints directory. Hydration of the `domaiNN` bluepriNNt MUST use its canonical name and version; the bare stem without version MUST NOT be used as a hydration name because it does not resolve.

#### Scenario: Listing bluepriNNts via MCP tool
- GIVEN bluepriNNts present in the local, global and skill locations
- WHEN `list_blueprints` is invoked
- THEN a structured JSON array is returned listing all discovered bluepriNNts, their versions, and their source location category (`domain`, `global`, `skill:<name>`)

#### Scenario: Hydrating skill bluepriNNt into the local domaiNN
- GIVEN a bluepriNNt residing in an installed skill's bundled-blueprints directory
- WHEN `hydrate_blueprint` is invoked for the active domaiNN
- THEN the package is copied into the local blueprints directory
- AND subsequent resolutions prioritize the local copy

#### Scenario: Hydrating the domaiNN bluepriNNt
- GIVEN the `domaiNN` bluepriNNt at `V_0-1-0`
- WHEN the hydrate tool is invoked with its canonical name and version
- THEN the package is written to `specs/bluepriNNts/domaiNN/V_0-1-0/`
- AND an invocation without a version does not silently resolve to it

### Requirement: Wizard Model Workflow Binds to the Canonical Versioned Template

The manifest `knowledge` workflow (`manifest/source.yaml` `workflows[knowledge].blueprint`, formerly `workflows[model].template`; the rename is decided in design D3 and specified by `manifest-governance`) MUST reference the canonical `domaiNN` bluepriNNt at `V_0-1-0` instead of the frozen `workspace_V_0-3-0_spec_NN`. The frozen `workspace` bluepriNNt MUST be listed under `frozen_blueprints:` and MUST NOT be offered for new domaiNN creation. Hydrating it MUST resolve through the existing store precedence without new `innfo-mcp` code. The hydrate fixture in `iNNfo/packages/innfo-mcp/src/tools/spec.spec.ts` MUST pin the new name as a regression guard. Regenerated manifest docs (`docs/use/manifest.md`, `docs/use/manifest-next.md`) MUST reflect the rebind.

#### Scenario: Wizard bootstraps from the domaiNN bluepriNNt
- GIVEN a user runs the wizard workflow that creates a kNNowledge domaiNN
- WHEN the workflow hydrates the bluepriNNt
- THEN the `domaiNN` `V_0-1-0` package resolves
- AND the scaffolded `domaiNN_NN.md` declares `parent_spec` pointing at the `domaiNN` bluepriNNt

#### Scenario: Frozen workspace bluepriNNt is not offered
- GIVEN the manifest after this change
- WHEN the wizard lists bluepriNNts for creating a new domaiNN
- THEN `domaiNN` is offered
- AND `workspace` is listed only under `frozen_blueprints:` and is not offered

#### Scenario: Hydration regression is guarded by fixture
- GIVEN the change is applied
- WHEN `spec.spec.ts` runs its hydrate fixture
- THEN hydration resolves the `domaiNN` name from the store

#### Scenario: Regenerated manifest docs reflect the rebind
- GIVEN `generate-manifest.js` runs with `--check` on the stable and preview channels
- WHEN `docs/use/manifest.md` and `docs/use/manifest-next.md` are regenerated
- THEN the `knowledge` workflow lists the `domaiNN` bluepriNNt in its `blueprint` field
- AND the frozen `workspace` entries are absent from the ACTIVE blueprint lists
