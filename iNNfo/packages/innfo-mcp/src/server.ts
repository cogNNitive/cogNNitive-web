#!/usr/bin/env node

/**
 * innfo-mcp — MCP server wrapping @cognnitive/innfo-core.
 *
 * Exposes semantic iNNfo tools over stdio transport for consumption by
 * MCP clients such as OpenCode Desktop.
 *
 * Every tool is ONE entry in `TOOL_REGISTRY` (definition + handler). The
 * ListTools result, the call dispatcher, and the tool count all derive from
 * that table — adding a tool is a single edit, with no separate switch arm or
 * count to keep in sync (see the registry section below).
 *
 * Every tool result is a versioned machine envelope: the payload keys are
 * preserved at the top level alongside a `version` field of the form
 * `innfo-<tool>@<major>`. Consumers MUST check the version before parsing;
 * optional fields may be added within a major, breaking shape or meaning
 * changes require a new major (see packages/innfo-core/src/envelope.ts).
 */

import { pathToFileURL } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ListToolsResult, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'

import { listModels, readModel } from './tools/list-read.js'
import {
  getSpec,
  getTemplateFromUrl,
  getTemplateFromModel,
  deriveNameFromUrl,
  listTemplates,
  hydrateTemplate,
  listTemplateProcedures,
  listTemplateSkills,
} from './tools/spec.js'
import {
  validateModel,
  validateModelUrl,
  applyChange,
  validateTemplate,
  initModel,
} from './tools/mutate.js'
import { checkWorkspace } from './tools/check-workspace.js'
import { queryUnits } from './tools/query-units.js'
import { resolveSources } from './tools/resolve-sources.js'
import { findRepoRoot } from './tools/repo-root.js'
import { syncWorkspaceManifest } from './tools/workspace-sync.js'
import { envelope, envelopeList } from '@cognnitive/innfo-core'

/**
 * Root directory for model scanning and `specs/` placement.
 *
 * Defaults to the repo root found by walking up from `process.cwd()` (so
 * `specs/` always lands inside the repo, not in some ambiguous
 * sibling/parent directory when the server is started from an unexpected
 * cwd), falling back to `process.cwd()` itself when no `.git` is found.
 */
const ROOT_DIR: string =
  process.env.INNFO_MODELS_DIR ?? findRepoRoot(process.cwd()) ?? process.cwd()

// MCP server version: injected at build time by tsup via `define`, so the
// standalone bundle (bin/innfo-mcp.bundle.js) stays self-contained when
// installed flat (e.g. ~/.agents/mcp/) — it never reads a sibling
// package.json at boot.
declare const __INNFO_MCP_VERSION__: string

export const server = new Server(
  { name: 'innfo-mcp', version: __INNFO_MCP_VERSION__ },
  { capabilities: { tools: {} } },
)

/* ── Tool registry ───────────────────────────────────────────── */

type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>

interface ToolEntry {
  definition: Tool
  handler: ToolHandler
}

/**
 * Single source of truth for the MCP tool surface: each entry pairs a tool's
 * JSON definition with the handler that serves it. Adding/removing a tool is a
 * one-entry change — `toolDefinitions`, `TOOL_COUNT`, and the dispatcher all
 * derive from this list.
 */
const TOOL_REGISTRY: ReadonlyArray<ToolEntry> = [
  {
    definition: {
      name: 'list_models',
      description: 'Scan the models directory and list all iNNfo models',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Optional override directory to scan' },
        },
      },
    },
    handler: handleListModels,
  },
  {
    definition: {
      name: 'read_model',
      description:
        "Parse and return an iNNfo model's full structure by its id. For surgical work prefer bounded slices: pass concept (+ element) with max_lines (default 150); slices over the cap truncate with truncated=true unless override_reason records a manual override",
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Model id (filename stem, e.g. Ghostbusters_V_0-1-0_business)',
          },
          root: {
            type: 'string',
            description: 'Optional models root directory override',
          },
          concept: {
            type: 'string',
            description: 'Optional concept slice (e.g. Models); returns only that concept',
          },
          element: {
            type: 'string',
            description: 'Optional element slice within the concept',
          },
          max_lines: {
            type: 'number',
            description: 'Line cap for the returned slice (default 150)',
          },
          override_reason: {
            type: 'string',
            description: 'Recorded reason to bypass the line cap for wide context',
          },
          intent: {
            type: 'string',
            description:
              'Optional intent class for this call (coach, surgical, verify, or match); omit for current behavior (no-op default)',
          },
        },
        required: ['id'],
      },
    },
    handler: handleReadModel,
  },
  {
    definition: {
      name: 'get_spec',
      description:
        'Resolve the iNNfo specification (level-1) from an explicit url or from a loaded model. Provide either url or model_id — the URL is never taken from an internal constant',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Explicit spec/template URL to resolve the parent chain from',
          },
          model_id: {
            type: 'string',
            description: 'Model id whose frontmatter parent_spec.url seeds resolution',
          },
          in_place: {
            type: 'boolean',
            description:
              'Write fetched templates inside the workspace tree (default false = OS temp cache, tree stays clean)',
          },
        },
      },
    },
    handler: handleGetSpec,
  },
  {
    definition: {
      name: 'get_template',
      description:
        'Resolve an iNNfo template (level-2) from an explicit url or from a loaded model. Provide either url or model_id — template names/URLs are never hardcoded',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Explicit template URL to resolve from' },
          model_id: {
            type: 'string',
            description: 'Model id whose parent_spec.url points to its template',
          },
          name: {
            type: 'string',
            description: 'Optional chain-start name; derived from the url when omitted',
          },
          in_place: {
            type: 'boolean',
            description:
              'Write fetched templates inside the workspace tree (default false = OS temp cache, tree stays clean)',
          },
        },
      },
    },
    handler: handleGetTemplate,
  },
  {
    definition: {
      name: 'validate_model',
      description:
        'Validate an iNNfo model against its template. Provide id (file on disk) or content (raw text). The template is resolved from the model parent_spec.url, or from an optional template_url',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Model id (reads from disk)' },
          content: { type: 'string', description: 'Raw model content string (inline)' },
          root: {
            type: 'string',
            description: 'Optional models root directory override (used only with id mode)',
          },
          template_url: {
            type: 'string',
            description:
              'Optional explicit template URL when the model has no resolvable parent_spec.url',
          },
          baseline_path: {
            type: 'string',
            description:
              'Optional path to a versioned validation-baseline.json: only NEW errors surface, known errors are suppressed and counted with a backlog link',
          },
          in_place: {
            type: 'boolean',
            description:
              'Write fetched templates inside the workspace tree (default false = OS temp cache, tree stays clean)',
          },
          workspace: {
            type: 'boolean',
            description:
              "Optional workspace-scope mode (default false = today's single-file behavior, unchanged). When true, also runs cross-model reference validation (qualified `[[Model Title :: Element Name]]` refs) and `sources::` Citation validation (referenced file exists under sources/nn/, `#heading-slug` resolves, no line ranges) across the whole workspace, merging diagnostics owned by this model. Requires `id` mode.",
          },
          intent: {
            type: 'string',
            description:
              'Optional intent class for this call (coach, surgical, verify, or match); omit for current behavior (no-op default)',
          },
        },
      },
    },
    handler: handleValidateModel,
  },
  {
    definition: {
      name: 'apply_change',
      description:
        'Apply an intent-level change to a model and re-validate. Returns updated model or validation errors',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Model id' },
          root: {
            type: 'string',
            description:
              'Optional workspace root override (defaults to the server root). Lets one server mutate models in an arbitrary workspace deterministically.',
          },
          op: {
            type: 'string',
            description: 'Operation to perform',
            enum: [
              'add_concept',
              'add_field',
              'set_marker',
              'add_element',
              'update_field',
              'remove_element',
              'rename_concept',
              'rename_element',
              'generate_index',
              'bump_version',
            ],
          },
          args: {
            type: 'object',
            description:
              'Operation-specific arguments. For update_field: { conceptName, elementName, fieldName, value } (overwrites a field on an existing element). For generate_index: { taxonomy? } (rebuilds the model taxonomy from present concepts). For bump_version: { version: "V_0-5-0" } (explicit) or { bump: "major" | "minor" | "patch" } (increment from the current model_version, default patch). Any op also accepts optional { rationale: string, approved_by: "user" | "agent" } (default "agent"), echoed into the Agent Modification provenance block returned on success.',
          },
        },
        required: ['id', 'op', 'args'],
      },
    },
    handler: handleApplyChange,
  },
  {
    definition: {
      name: 'validate_model_url',
      description:
        'Validate an iNNfo model fetched from a URL without writing to disk. Accepts a model URL and optional template_url. Returns validation results.',
      inputSchema: {
        type: 'object',
        properties: {
          model_url: {
            type: 'string',
            description: 'URL pointing to the iNNfo model content to validate',
          },
          template_url: {
            type: 'string',
            description:
              'Optional explicit template URL when the model has no resolvable parent_spec.url',
          },
        },
        required: ['model_url'],
      },
    },
    handler: handleValidateModelUrl,
  },
  {
    definition: {
      name: 'validate_template',
      description:
        'Validate a Level 2 template against its Level 1 parent spec with frontmatter level-2 auto-detection and parent resolution failure diagnostics',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Template model id (reads from disk)' },
          content: { type: 'string', description: 'Raw template content string (inline)' },
          url: { type: 'string', description: 'Explicit parent spec URL override' },
          root: { type: 'string', description: 'Optional models root directory override' },
        },
      },
    },
    handler: handleValidateTemplate,
  },
  {
    definition: {
      name: 'init_model',
      description:
        'Initialize or repair a level-3 model file: writes canonical YAML frontmatter and, when the file has no concept sections and the template resolves, scaffolds a starter body (index block + one section per Concept) from the template schema. Returns templateResolved / scaffolded / warnings.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Model ID/filename stem (e.g. arenzano_V_0-1-0_cogNNitive)',
          },
          template_url: { type: 'string', description: 'Immutable URL of the parent template' },
          template_name: {
            type: 'string',
            description: 'Name of the parent template (e.g. cogNNitive_V_0-1-0)',
          },
          title: { type: 'string', description: 'Logical title of the model (defaults to ID)' },
          model_version: {
            type: 'string',
            description:
              'Initial version of the model (e.g. V_0-1-0). When omitted it is inferred from the resolved parent template spec_version. When provided and different from the parent spec_version, the call fails with VERSION_MISMATCH. The model is scaffolded against the adopted L1 spec iNNfo_V_0-2-1.',
          },
          in_place: {
            type: 'boolean',
            description:
              'Write fetched templates inside the workspace tree (default false = OS temp cache, tree stays clean)',
          },
          root: { type: 'string', description: 'Optional models root directory override' },
        },
        required: ['id', 'template_url', 'template_name'],
      },
    },
    handler: handleInitModel,
  },
  {
    definition: {
      name: 'list_templates',
      description:
        'List all available Level 2 spec templates across local workspace, global environment, and installed skills',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Optional workspace root directory override' },
        },
      },
    },
    handler: handleListTemplates,
  },
  {
    definition: {
      name: 'hydrate_template',
      description:
        'Hydrate (copy) a Level 2 spec template from global or skill store into active workspace templates directory',
      inputSchema: {
        type: 'object',
        properties: {
          template_name: {
            type: 'string',
            description: 'Name of template to hydrate (e.g. workspace_spec_NN)',
          },
          root: { type: 'string', description: 'Optional workspace root directory override' },
          target_dir: {
            type: 'string',
            description: 'Optional target directory override (defaults to ./templates/)',
          },
        },
        required: ['template_name'],
      },
    },
    handler: handleHydrateTemplate,
  },
  {
    definition: {
      name: 'sync_workspace_manifest',
      description:
        'Reconcile the workspace manifest ## NN Models entries against discovered Level-3 model files: additively appends new entries, archives entries whose file disappeared, and reactivates tool-owned entries whose file returned. Never touches hand-authored entries lacking the <!-- nn:auto --> ownership marker. Defaults to a dry run.',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Optional workspace root directory override' },
          dry_run: {
            type: 'boolean',
            description: 'Report computed changes/diff without writing (defaults to true)',
          },
        },
      },
    },
    handler: handleSyncWorkspaceManifest,
  },
  {
    definition: {
      name: 'check_workspace',
      description:
        'Run one consolidated workspace integrity pass over every Level-3 model: validate each against its template and traceability, self-heal missing template packages/specs (write-once hydration), classify each pinned template version against the published catalog, and return one report with a per-model status and a workspace aggregate. Non-blocking and informational — validation failures never fail the tool.',
      inputSchema: {
        type: 'object',
        properties: {
          root: {
            type: 'string',
            description: 'Optional workspace root directory override (default: server root)',
          },
          summary_only: {
            type: 'boolean',
            description:
              'Omit clean models; return the aggregate plus failing/upgrade-available models only (capped at 25). Default false.',
          },
          offline: {
            type: 'boolean',
            description:
              'Skip all network: no catalog fetch, no hydration, no freshness. Default false.',
          },
        },
      },
    },
    handler: handleCheckWorkspace,
  },
  {
    definition: {
      name: 'query_units',
      description:
        'Run a read-only content query over one workspace file and return matching knowledge-unit URIs: "path?filter=value[&filter...][&projection]". Filters use exact match (trimmed, case-insensitive); a trailing bare segment projects one column/field over the matches. Capped at 100 results with truncated=true. Pass max_values_chars to cap projected value characters for slice-only surgical reads. Never writes files.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Query string, e.g. "sources/nn/m.csv?segmento=Enterprise&mrr_usd"',
          },
          root: {
            type: 'string',
            description: 'Optional workspace root directory override (default: server root)',
          },
          max_values_chars: {
            type: 'number',
            description: 'Optional cap on total projected value characters',
          },
          intent: {
            type: 'string',
            description:
              'Optional intent class for this call (coach, surgical, verify, or match); omit for current behavior (no-op default)',
          },
        },
        required: ['query'],
      },
    },
    handler: handleQueryUnits,
  },
  {
    definition: {
      name: 'resolve_sources',
      description:
        'Read-only: resolve an element\'s citation-typed field(s) to their underlying file, anchor, and content. Returns one entry per citation reference: {path, anchor, exists, excerpt?, sha256?, version?, error?}. Omit fieldName to resolve across every citation-typed field on the element (name-based sources/source plus any schema-declared type:: citation field). Never writes files.',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model id (filename stem)' },
          elementId: { type: 'string', description: 'Element name within the model' },
          fieldName: {
            type: 'string',
            description: 'Optional: restrict resolution to this single field',
          },
          root: {
            type: 'string',
            description: 'Optional workspace root directory override (default: server root)',
          },
        },
        required: ['model', 'elementId'],
      },
    },
    handler: handleResolveSources,
  },
  {
    definition: {
      name: 'list_template_procedures',
      description:
        'List all procedures defined in a template and its transitively included templates up to depth 10',
      inputSchema: {
        type: 'object',
        properties: {
          model_path: { type: 'string', description: 'Optional model file path or ID' },
          model_id: { type: 'string', description: 'Optional model ID' },
          template_name: { type: 'string', description: 'Optional template name' },
          version: { type: 'string', description: 'Optional template version' },
          url: { type: 'string', description: 'Optional template URL' },
          root: { type: 'string', description: 'Optional workspace root directory override' },
        },
      },
    },
    handler: handleListTemplateProcedures,
  },
  {
    definition: {
      name: 'list_template_skills',
      description:
        'List all agent skills defined in a template and its transitively included templates up to depth 10',
      inputSchema: {
        type: 'object',
        properties: {
          model_path: { type: 'string', description: 'Optional model file path or ID' },
          model_id: { type: 'string', description: 'Optional model ID' },
          template_name: { type: 'string', description: 'Optional template name' },
          version: { type: 'string', description: 'Optional template version' },
          url: { type: 'string', description: 'Optional template URL' },
          root: { type: 'string', description: 'Optional workspace root directory override' },
        },
      },
    },
    handler: handleListTemplateSkills,
  },
]

/** Tool definitions advertised by ListTools — derived from the registry. */
export const toolDefinitions: Tool[] = TOOL_REGISTRY.map((entry) => entry.definition)

/** Number of registered tools — single source for the count (no brittle literal). */
export const TOOL_COUNT = TOOL_REGISTRY.length

/* ── Tool call dispatcher ────────────────────────────────────── */

const handlersByName = new Map<string, ToolHandler>(
  TOOL_REGISTRY.map((entry) => [entry.definition.name, entry.handler]),
)

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const handler = handlersByName.get(name)
    if (!handler) return errorResult(`Unknown tool: ${name}`)
    return await handler(args)
  } catch (err) {
    return errorResult(String(err))
  }
}

/* ── Handlers ────────────────────────────────────────────────── */

async function handleListModels(args: Record<string, unknown>): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const models = await listModels(root)
  return textResult(JSON.stringify(envelopeList('innfo-list-models', 'models', models), null, 2))
}

async function handleReadModel(args: Record<string, unknown>): Promise<CallToolResult> {
  const id = args.id as string
  if (!id) return errorResult('Missing required argument: id')
  const root = (args.root as string) || ROOT_DIR
  const model = await readModel(root, id, {
    concept: args.concept as string | undefined,
    element: args.element as string | undefined,
    max_lines: args.max_lines as number | undefined,
    override_reason: args.override_reason as string | undefined,
  })
  if (!model) return errorResult(`Model not found: ${id}`)
  return textResult(JSON.stringify(envelope('innfo-read-model', model), null, 2))
}

async function handleGetSpec(args: Record<string, unknown>): Promise<CallToolResult> {
  const url = args.url as string | undefined
  const modelId = args.model_id as string | undefined
  if (!url && !modelId) return errorResult('Provide either url or model_id')
  const result = await getSpec(
    ROOT_DIR,
    { url, modelId },
    { inPlace: args.in_place as boolean | undefined },
  )
  if (!result.spec) return errorResult('Spec could not be resolved from the provided url/model_id')
  return textResult(JSON.stringify(envelope('innfo-get-spec', result), null, 2))
}

async function handleGetTemplate(args: Record<string, unknown>): Promise<CallToolResult> {
  const url = args.url as string | undefined
  const modelId = args.model_id as string | undefined
  const name = args.name as string | undefined

  let template = null
  if (url) {
    template = await getTemplateFromUrl(ROOT_DIR, url, name ?? deriveNameFromUrl(url), {
      inPlace: args.in_place as boolean | undefined,
    })
  } else if (modelId) {
    template = await getTemplateFromModel(ROOT_DIR, modelId, {
      inPlace: args.in_place as boolean | undefined,
    })
  } else {
    return errorResult('Provide either url or model_id')
  }

  if (!template) return errorResult('Template could not be resolved from the provided url/model_id')
  return textResult(JSON.stringify(envelope('innfo-get-template', template), null, 2))
}

async function handleValidateModel(args: Record<string, unknown>): Promise<CallToolResult> {
  const id = args.id as string | undefined
  const content = args.content as string | undefined
  const templateUrl = args.template_url as string | undefined
  const workspace = args.workspace as boolean | undefined
  if (!id && !content) return errorResult('Provide either id or content')
  const root = (args.root as string) || ROOT_DIR
  const result = await validateModel(root, id, content, templateUrl, workspace, {
    baselinePath: args.baseline_path as string | undefined,
    inPlace: args.in_place as boolean | undefined,
  })
  return textResult(JSON.stringify(envelope('innfo-validate-model', result), null, 2))
}

async function handleValidateModelUrl(args: Record<string, unknown>): Promise<CallToolResult> {
  const modelUrl = args.model_url as string | undefined
  if (!modelUrl) return errorResult('Missing required argument: model_url')
  const templateUrl = args.template_url as string | undefined
  const result = await validateModelUrl(ROOT_DIR, modelUrl, templateUrl)
  return textResult(JSON.stringify(envelope('innfo-validate-model-url', result), null, 2))
}

async function handleApplyChange(args: Record<string, unknown>): Promise<CallToolResult> {
  const id = args.id as string
  const op = args.op as string
  const opArgs = args.args as Record<string, unknown>
  if (!id || !op || !opArgs) {
    return errorResult('Missing required arguments: id, op, args')
  }
  const root = (args.root as string) || ROOT_DIR
  const result = await applyChange(root, id, op, opArgs)
  return textResult(JSON.stringify(envelope('innfo-apply-change', result), null, 2))
}

async function handleValidateTemplate(args: Record<string, unknown>): Promise<CallToolResult> {
  const id = args.id as string | undefined
  const content = args.content as string | undefined
  const url = args.url as string | undefined
  if (!id && !content) return errorResult('Provide either id or content')
  const root = (args.root as string) || ROOT_DIR
  const result = await validateTemplate(root, id, content, url)
  return textResult(JSON.stringify(envelope('innfo-validate-template', result), null, 2))
}

async function handleInitModel(args: Record<string, unknown>): Promise<CallToolResult> {
  const id = args.id as string
  const template_url = args.template_url as string
  const template_name = args.template_name as string
  const title = args.title as string | undefined
  const model_version = args.model_version as string | undefined
  const root = (args.root as string) || ROOT_DIR
  if (!id || !template_url || !template_name) {
    return errorResult('Missing required arguments: id, template_url, template_name')
  }
  const result = await initModel(
    root,
    id,
    { template_url, template_name, title, model_version },
    { inPlace: args.in_place as boolean | undefined },
  )
  return textResult(JSON.stringify(envelope('innfo-init-model', result), null, 2))
}

async function handleListTemplates(args: Record<string, unknown>): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const templates = await listTemplates(root)
  return textResult(
    JSON.stringify(envelopeList('innfo-list-templates', 'templates', templates), null, 2),
  )
}

async function handleHydrateTemplate(args: Record<string, unknown>): Promise<CallToolResult> {
  const templateName = args.template_name as string
  if (!templateName) return errorResult('Missing required argument: template_name')
  const root = (args.root as string) || ROOT_DIR
  const targetDir = args.target_dir as string | undefined
  const result = await hydrateTemplate(root, templateName, { targetDir })
  return textResult(JSON.stringify(envelope('innfo-hydrate-template', result), null, 2))
}

async function handleSyncWorkspaceManifest(args: Record<string, unknown>): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const dry_run = args.dry_run !== undefined ? Boolean(args.dry_run) : true
  const result = await syncWorkspaceManifest(root, { dry_run })
  return textResult(JSON.stringify(envelope('innfo-sync-workspace-manifest', result), null, 2))
}

async function handleCheckWorkspace(args: Record<string, unknown>): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const report = await checkWorkspace(root, {
    summaryOnly: Boolean(args.summary_only),
    offline: Boolean(args.offline),
  })
  return textResult(JSON.stringify(envelope('innfo-check-workspace', report), null, 2))
}

async function handleQueryUnits(args: Record<string, unknown>): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const result = await queryUnits(root, String(args.query ?? ''), {
    max_values_chars: args.max_values_chars as number | undefined,
  })
  return textResult(JSON.stringify(envelope('innfo-query-units', result), null, 2))
}

async function handleResolveSources(args: Record<string, unknown>): Promise<CallToolResult> {
  const model = args.model as string
  const elementId = args.elementId as string
  if (!model || !elementId) return errorResult('Missing required arguments: model, elementId')
  const root = (args.root as string) || ROOT_DIR
  const results = await resolveSources(root, {
    model,
    elementId,
    fieldName: args.fieldName as string | undefined,
  })
  return textResult(
    JSON.stringify(envelopeList('innfo-resolve-sources', 'citations', results), null, 2),
  )
}

async function handleListTemplateProcedures(
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const result = await listTemplateProcedures(root, {
    model_path: args.model_path as string | undefined,
    model_id: args.model_id as string | undefined,
    template_name: args.template_name as string | undefined,
    version: args.version as string | undefined,
    url: args.url as string | undefined,
  })
  return textResult(JSON.stringify(envelope('innfo-list-template-procedures', result), null, 2))
}

async function handleListTemplateSkills(args: Record<string, unknown>): Promise<CallToolResult> {
  const root = (args.root as string) || ROOT_DIR
  const result = await listTemplateSkills(root, {
    model_path: args.model_path as string | undefined,
    model_id: args.model_id as string | undefined,
    template_name: args.template_name as string | undefined,
    version: args.version as string | undefined,
    url: args.url as string | undefined,
  })
  return textResult(JSON.stringify(envelope('innfo-list-template-skills', result), null, 2))
}

/* ── Response helpers ────────────────────────────────────────── */

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/* ── Handlers ────────────────────────────────────────────────── */

server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
  return { tools: toolDefinitions }
})

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params
  return dispatchTool(name, (args ?? {}) as Record<string, unknown>)
})

/* ── Start ──────────────────────────────────────────────────── */

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Only auto-start the stdio transport when this file is run directly
// (e.g. `node dist/server.js`), never when imported by tests or other modules.
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error starting innfo-mcp:', err)
    process.exit(1)
  })
}
