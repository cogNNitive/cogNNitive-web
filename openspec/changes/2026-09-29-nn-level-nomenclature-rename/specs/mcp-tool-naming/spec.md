## ADDED Requirements

### Requirement: New MCP tool names are canonical and have no aliases

`innfo-mcp` registers 17 tools. It MUST register the following canonical names for the 13 tools that are renamed, and MUST NOT register the old names, alias names or deprecation shims:

| Old | New |
|---|---|
| `list_models`, `read_model`, `init_model` | `list_knowledge`, `read_knowledge`, `init_knowledge` |
| `validate_model`, `validate_model_url` | `validate_knowledge`, `validate_knowledge_url` |
| `get_template`, `validate_template`, `list_templates`, `hydrate_template` | `get_blueprint`, `validate_blueprint`, `list_blueprints`, `hydrate_blueprint` |
| `list_template_procedures`, `list_template_skills` | `list_blueprint_procedures`, `list_blueprint_skills` |
| `sync_workspace_manifest`, `check_workspace` | `sync_domain_manifest`, `check_domain` |

The four tools `get_spec`, `apply_change`, `query_units` and `resolve_sources` keep their names. The name is singular because the noun is uncountable (`list_knowledge`, not `list_knowledges`). Argument and payload keys MUST follow the same map: `model_id` becomes `knowledge_id`, `template_url` becomes `blueprint_url`, `workspace` becomes `domain`, and the list key `models` becomes `knowledge`. Envelope ids MUST follow the new tool names at major version 1 (`innfo-<tool>@1`).

#### Scenario: Tool list contains only canonical names
- **GIVEN** a running `innfo-mcp` server
- **WHEN** its tool list is requested
- **THEN** it contains the 13 new names and the 4 unchanged names, 17 in total
- **AND** none of `list_models`, `read_model`, `get_template`, `check_workspace`, `list_templates`, `hydrate_template` or the other retired names is present

#### Scenario: Argument and payload keys renamed
- **GIVEN** the `read_knowledge` and `hydrate_blueprint` tool schemas
- **WHEN** their arguments are inspected
- **THEN** they use `knowledge_id`, `blueprint_url` and `domain`
- **AND** none of `model_id`, `template_url` or `workspace` is accepted

#### Scenario: Old name is an unknown tool
- **GIVEN** a client that calls `get_template`
- **WHEN** the server handles the call
- **THEN** it responds that the tool does not exist
- **AND** it does not forward to a renamed tool

### Requirement: A legacy domain yields a migration hint from every tool

Until the S11 cleanup, when a canonical tool is called against a legacy domain, it MUST return a structured result that marks the domain as legacy, points to nn-upgrade, and performs no read-through of legacy content and no write.

#### Scenario: Read tool on a legacy domain
- **GIVEN** a domain with the legacy entrypoint and `models/`
- **WHEN** `list_knowledge` is called
- **THEN** it returns the legacy notice with the nn-upgrade pointer
- **AND** it returns no knowledge listing

#### Scenario: Write tool on a legacy domain
- **GIVEN** a legacy domain
- **WHEN** a canonical mutation or scaffold tool is called
- **THEN** it refuses with the legacy notice
- **AND** the domain is unchanged

### Requirement: The domain root environment variable has no fallback

`innfo-mcp` MUST read `INNFO_DOMAIN_DIR` (the domain root, which is what `INNFO_MODELS_DIR` held) and MUST NOT read `INNFO_MODELS_DIR`. The default of `INNFO_GLOBAL_DIR` MUST be `~/.agents/bluepriNNts`. If only the retired variable is set, the server MUST behave as if no override were set.

#### Scenario: New variable honoured
- **GIVEN** `INNFO_DOMAIN_DIR` set to a directory
- **WHEN** a tool resolves the domain root
- **THEN** it uses that directory

#### Scenario: Global directory default
- **GIVEN** `INNFO_GLOBAL_DIR` is not set
- **WHEN** the global bluepriNNt cache is resolved
- **THEN** it is `~/.agents/bluepriNNts`

#### Scenario: Retired variable ignored
- **GIVEN** only `INNFO_MODELS_DIR` set
- **WHEN** a tool resolves the domain root
- **THEN** the retired variable has no effect

### Requirement: Descriptions, remote fetch and bundled procedures use the new names

Tool descriptions, the MCP README, the remote package fetch and bluepriNNt procedures shipped from this change MUST refer only to canonical names. The remote fetch MUST accept only refs matching `^blueprints-v\d+\.\d+\.\d+$`, MUST use `iNNfo/specs/bluepriNNts/<base>` as the directory in the repository with no special case for `domaiNN`, and MUST require the `ref` argument (no default derived from the blueprint version). Frozen tag-pinned packages that predate this change are permanent history and are not rewritten.

#### Scenario: Procedures call canonical tools
- **GIVEN** the procedures shipped in current bluepriNNt packages
- **WHEN** they are searched for MCP tool names
- **THEN** every referenced name is canonical

#### Scenario: Remote fetch targets the new layout
- **GIVEN** a domain without local specs
- **WHEN** the resolver fetches a bluepriNNt package remotely
- **THEN** the request uses `iNNfo/specs/bluepriNNts/` and a `blueprints-v*` ref
- **AND** a ref such as `templates-v0.17.0` is rejected

#### Scenario: Ref is required
- **GIVEN** a remote fetch call without a `ref`
- **WHEN** the resolver runs
- **THEN** it fails and does not derive a ref from the blueprint version

### Requirement: The MCP exposes no migrate tool

`innfo-mcp` MUST NOT register a migration tool. The MCP MAY import only `detectLegacy`, through the subpath export `@cognnitive/innfo-core/legacy`, to produce the migration hint.

#### Scenario: No migrate tool registered
- **GIVEN** a running `innfo-mcp` server
- **WHEN** its tool list is requested
- **THEN** no tool named `migrate_domain` or equivalent is present
