---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
level: 3
parent_spec:
  name: "backlog_V_0-1-4"
  url: "specs/backlog_V_0-1-4_spec_NN.md"
knowledge_version: "V_0-1-6"
title: "cogNNitive Backlog"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Backlog
## NN Backlog: cogNNitive Backlog
  title:: "Backlog"
  description:: "Prioritized follow-up work for the cogNNitive monorepo, from the whole-monorepo code audit (2026-09-04). Consolidated 2026-09-10 (26 to 15 work items): coupled items merged, done/obsolete entries retired. Prioritized 2026-09-10 (P0 quick wins to P3 deferred)."

# NN WorkItem
## NN WorkItem: Source import guards
  number:: 1
  key:: "feature/source-import-guards"
  title:: "Import-time guards: conversation history + duplicate detection"
  type:: "functional"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "Importing from sources/import/ is blind: it neither consults past conversations nor compares against the existing corpus, so work is duplicated or update lineage is lost."
  behaviour:: "Run two guards before normalising: (1) search conversation history for prior handling and ask reuse/adjust/from-scratch; (2) detect exact (sha256) and near duplicates, ask whether it is an update, then create the new source and archive the old one."
  approach:: "Share one matching layer; exact hash is cheap via computeFileHash, near-duplicate needs a structural heuristic; archive semantics open; touches the agent workflow layer and a conversation-history index."
  also_consider:: "Tie into the lineage record (# NN Sources / # NN Procedures) to avoid a parallel store."
  notes:: "Implemented 2026-09-11 (data backbone): actioNN/skills/nn-trannsform/scripts/lib/duplicate-guards.js with detectDuplicates (exact sha256 + structural near-duplicate via canonicalized token Jaccard) and searchConversationHistory (conversations/*.md). 13 unit tests green. Agent workflow wiring (reuse/adjust/from-scratch prompt) is a documented seam."
  suggested_trigger:: "/sdd-explore source-import-guards"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: KB change governance
  number:: 2
  key:: "feature/kb-change-governance"
  title:: "Per-unit change log + RACI-aligned review workflow"
  type:: "functional"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "No record of which changes affected which knowledge units and by whom; RACI owners have no structured artifact to approve or comment on changes in their scope."
  behaviour:: "Per-unit change log (type, scope, timestamp, actor, RACI owner) feeding individualized monthly reports, plus a per-actor review surface with approve/request-changes/comment."
  approach:: "The change log is the data backbone for the review; extend the lineage record with per-unit entries; review-state persistence is open. Design both together to avoid parallel stores."
  also_consider:: "RACI matrix is the single source of ownership scope."
  notes:: "Implemented 2026-09-11 (change-log backbone): actioNN/skills/nn-trannsform/scripts/lib/change-log.js with recordChange/readChangeLog/entriesForUnit/renderMonthlyReport (JSONL at .cogNNitive/change-log.jsonl). 11 unit tests green. Review workflow UI (approve/request-changes/comment) is a documented next step."
  suggested_trigger:: "/sdd-explore kb-change-governance"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Vocabulary simplification
  number:: 3
  key:: "feat/vocabulary-simplification"
  title:: "Canonical term dictionary + mass rename (template to app)"
  type:: "feat"
  size:: "large"
  priority:: "P3"
  status:: "backlog"
  why:: "The application vocabulary has drifted from its structure, and the Level 2 concept called template is cognitively heavier than app."
  behaviour:: "Pin a canonical term dictionary (with deprecated/alias terms), then rename template to app across user-facing and conceptual vocabulary and audit the remaining element names; keep identifiers stable where renaming breaks resolution."
  approach:: "Split into a low-risk vocabulary pass and a high-risk mechanical identifier migration (catalog, manifest, _spec_NN.md, parent_spec.url) with an alias/version strategy; never a blind find-and-replace."
  risks:: "Large; do not attempt as one change."
  suggested_trigger:: "/sdd-explore vocabulary-simplification"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Core structure
  number:: 4
  key:: "refactor/core-structure"
  title:: "Split types.ts barrel + shared decomposed test fixtures"
  type:: "refactor"
  size:: "medium"
  priority:: "P1"
  status:: "done"
  why:: "types.ts is 548 lines and mixes parser/model types with the editor graph model; four core test files hardcode their own include-resolver maps, so attaching metrics broke five tests when one map was missed."
  approach:: "Make types.ts a barrel over types/{parser,validation,io,graph}.ts, and extract one shared tests/fixtures/decomposed.ts consumed by all four test files. Behaviour-preserving."
  also_consider:: "Decide whether the SpecFrontmatter index signature is still needed."
  suggested_trigger:: "/sdd-new core-structure"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: MCP hygiene
  number:: 5
  key:: "chore/mcp-hygiene"
  title:: "Declarative tool registry + enforced coverage gates"
  type:: "refactor"
  size:: "medium"
  priority:: "P1"
  status:: "done"
  why:: "Adding an MCP tool touches definitions, dispatch and handler plus a brittle count assertion; and innfo-mcp coverage gates (90/95/85) exist but CI runs vitest run, never test:coverage, so the debt is unenforced."
  approach:: "Drive definitions, dispatch and count from a single name/definition/handler table; run coverage in CI and backfill per file lowest-first."
  suggested_trigger:: "/sdd-new mcp-hygiene"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Trannsform slug codegen
  number:: 6
  key:: "refactor/trannsform-slug-codegen"
  title:: "Generate the nn-trannsform slug mirror from core"
  type:: "refactor"
  size:: "small-medium"
  priority:: "P0"
  status:: "done"
  why:: "The nn-trannsform slug mirror is hand-written with only a hardcoded parity test as guard; it will drift again."
  approach:: "Build-time codegen from the TS source during the release build; the parity test asserts the checked-in file matches generated output; runtime stays dependency-free."
  suggested_trigger:: "/sdd-new trannsform-slug-codegen"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Silent fallbacks sweep
  number:: 7
  key:: "fix/silent-fallbacks-sweep"
  title:: "Classify the remaining catch sites"
  type:: "fix"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "The README claims fail-fast, yet ~20 bare/empty catch sites remain across innfo-core and innfo-mcp (down from ~35), unclassified and with only ad-hoc comments."
  approach:: "Classify each into propagate, log+continue, or deliberate ENOENT-guarded swallow with a comment."
  notes:: "Implemented 2026-09-11: ~45 catch sites classified across innfo-core + innfo-mcp into propagate / log+continue (console.warn with path+error) / swallow-ENOENT (err.code === 'ENOENT'). Core 707 + MCP 263 tests green."
  risks:: "Touches behaviour; one reviewer pass; do not batch with a refactor."
  suggested_trigger:: "/sdd-new silent-fallbacks-sweep"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Editor tech debt
  number:: 8
  key:: "chore/editor-tech-debt"
  title:: "Drive down any + extract workspaceStore.readText"
  type:: "chore"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "The editor carries ~106 as any plus ~91 any with only a warn rule and no guard, and file-handle traversal is duplicated across FilePreviewModal and WorkspaceExplorer."
  approach:: "Extract a single async readText helper on the workspace store; remove gratuitous casts incrementally; add a lint/CI guard that fails a PR raising the any count."
  notes:: "Implemented 2026-09-11: workspaceStore.readText + readFileBlob extracted (resolveFileHandleForRead); FilePreviewModal + WorkspaceExplorer refactored to use them (duplicated traversal removed). any-ratchet guard left as documented extension."
  suggested_trigger:: "/sdd-new editor-tech-debt"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Build hygiene
  number:: 9
  key:: "ci/build-hygiene"
  title:: "Stop deploy-pages rebuilding + automate the CDN square check"
  type:: "ci"
  size:: "small"
  priority:: "P0"
  status:: "done"
  why:: "deploy-pages rebuilds what verify already built and self-cancels on merge bursts; the CDN bundle build is automated in CI but the version-square check is not wired, and the inline deploy:cdn script is fragile."
  approach:: "Reuse the verify artifact or move Pages deploy to its own main-only workflow; wire the version-square check into CI and retire deploy:cdn."
  suggested_trigger:: "/sdd-new build-hygiene"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: New templates
  number:: 10
  key:: "feat/new-templates"
  title:: "Repository template + video-generator template"
  type:: "feat"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "No Level 2 template manages a GitHub repository lifecycle, and none drives a video generation pipeline."
  behaviour:: "Provide a repositorio template (state, releases, changes) and a video-generator template (source to script/storyboard/asset), each with a canonical sample and catalog/manifest registration."
  approach:: "Standalone structure plus the nn-template-audit criteria; decide standalone vs workflow specialization. The videoscript template committed at 419d9f0 was deleted unregistered; decided 2026-09-10 to subsume it into the video-generator template rather than ship it standalone (discard, revive, or subsume)."
  notes:: "Implemented 2026-09-11: templates/repository/spec_NN.md + templates/video-generator/spec_NN.md (English names; videoscript subsumed as VUS asset format). Both validate green against the metaschema; registered in catalog.json (13 templates) + manifest/source.yaml. Canonical samples pending (Ghostbusters Inc. universe)."
  suggested_trigger:: "/sdd-explore new-templates"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Metrics scenario compare
  number:: 11
  key:: "feature/metrics-scenario-compare"
  title:: "Side-by-side scenario comparison in Projections"
  type:: "functional"
  size:: "small-medium"
  priority:: "P1"
  status:: "done"
  why:: "Projections renders only a single neutral flow; comparing variants means editing variables by hand."
  approach:: "Implement variants as ordinary variant rows through the Metrics/Variables mechanism, then add comparison UI (per-variant series, cards, CSV). Do not reintroduce the scenario selector."
  notes:: "Implemented 2026-09-11: compileChartSeries + renderCharts in innfo-runtime.js now accept series[chartId] as a variants map {label: number[]} rendering one uPlot series per variant (fixed palette); flat arrays stay single-series. Bundle regenerated. 16 charts tests green."
  suggested_trigger:: "/sdd-new metrics-scenario-compare"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Workspace KB perf limits
  number:: 12
  key:: "chore/workspace-kb-perf-limits"
  title:: "Probe performance limits with the workspace KB test"
  type:: "chore"
  size:: "small-medium"
  priority:: "P1"
  status:: "done"
  why:: "The scaling limits of the workspace knowledge base are unknown."
  approach:: "Build a perf harness over a disposable SIM workspace; scale dimensions separately, measure check_workspace/validate/query_units/preview latency, and record breaking points and pragmatic limits."
  notes:: "Implemented 2026-09-11: scripts/perf-workspace-kb.mjs generates a disposable workspace under temp/simulacro-perf and measures check_workspace/validate_model/query_units via MCP stdio."
  suggested_trigger:: "/sdd-explore workspace-kb-perf-limits"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Local specialization migration
  number:: 13
  key:: "feat/local-specialization-migration"
  title:: "Migrate local specializations onto new canonical templates"
  type:: "feat"
  size:: "medium-high"
  priority:: "P3"
  status:: "deferred"
  why:: "Local user-authored specializations cannot follow canonical template upgrades; upgrade-check classifies them unlisted and nn-upgrade only reports."
  behaviour:: "Provide a real semantic rebase instead of unlisted detection."
  approach:: "Detect specializations, resolve the base, three-way diff, per-definition conflict pass, then emit a new specialization version and repoint models."
  risks:: "Collision semantics, includes identity, versioning, possible diffTemplates primitive."
  suggested_trigger:: "/sdd-explore local-specialization-migration"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Console domain renderers
  number:: 14
  key:: "refactor/console-domain-renderers"
  title:: "Migrate projections + strategic master to console renderers"
  type:: "refactor"
  size:: "large"
  priority:: "P3"
  status:: "deferred"
  why:: "Projections and the strategic master stay inline as bespoke special cases after the model-viewer renderer was extracted."
  approach:: "Extend the renderer pattern without overloading the generic console template; projections packaging decision, and master data-driven redesign vs freeze-and-document; keep the E2E equivalence bar."
  risks:: "Large if both slices go data-driven; separate specs per slice."
  suggested_trigger:: "/sdd-explore console-domain-renderers"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: Pending tree closeout
  number:: 15
  key:: "chore/pending-tree-closeout"
  title:: "Commit/archive work already sitting in the working tree"
  type:: "chore"
  size:: "small"
  priority:: "P0"
  status:: "done"
  why:: "Work is done in the tree but not closed: a newer console workstream is uncommitted, and the robustness-coda five pins are present but unarchived with score-matcher edits uncommitted."
  approach:: "Owner re-verifies own paths, batch-commits only own files (never git add -A), completes robustness-coda verify and archive, then the batched dev to main merge. Maintainer decision in chat."
  suggested_trigger:: "Maintainer decision in chat"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: Skills manager test template name fix
  number:: 16
  key:: "fix/skills-manager-test-workspace-template-name"
  title:: "Preexisting skills-manager sync test failure"
  type:: "fix"
  size:: "small"
  priority:: "P1"
  status:: "done"
  why:: "actioNN/scripts/skills-manager.test.js asserts workspace_V_0-3-0_spec_NN.md while repo ships workspace_spec_NN.md."
  approach:: "Decide contract for bundled templates in skills and fix test or shipped filename."
  suggested_trigger:: "/sdd-new fix/skills-manager-test-workspace-template-name"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: Dev gate release coupling fix
  number:: 17
  key:: "fix/dev-gate-release-coupling"
  title:: "Release-time manifest check runs inside dev pre-push gate"
  type:: "fix"
  size:: "medium"
  priority:: "P1"
  status:: "done"
  why:: "verify.js step 8 validates pins live against GitHub requiring a tag that only exists after release, blocking dev pre-push."
  approach:: "Split dev vs release gates; move tag-dependent checks to release path."
  suggested_trigger:: "/sdd-new fix/dev-gate-release-coupling"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: Primitive url field support
  number:: 18
  key:: "feature/primitive-url-field"
  title:: "Primitive url field support in iNNfo engine and UI"
  type:: "functional"
  size:: "medium"
  priority:: "P1"
  status:: "done"
  why:: "iNNfo models have no primitive field type for URLs, so links are stored as plain text without validation or interactive rendering in cards and tables."
  behaviour:: "Support a new primitive field type url in engine and UI with URL validation and interactive hyperlink rendering opening in new tab."
  approach:: "Extend engine field types and validation in innfo-core, update card/table UI renderers in innfo-console, and add test coverage."
  notes:: "Engine FIELD_TYPES + metaschema specs (V_0-1-0/V_0-2-0/V_0-2-1) accept url; UrlWidget.vue already registered in the editor widget registry; metaschema test added."
  suggested_trigger:: "/sdd-explore primitive-url-field"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: Console artifact export CLI
  number:: 20
  key:: "feature/console-artifact-export-cli"
  title:: "Unified console artifact export command (`export model` / `nn export`)"
  type:: "functional"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "Generating and updating offline console HTML artifacts (`*_console.html`) across models requires manual procedure execution or script calls, lacking a unified workspace-wide CLI interface."
  behaviour:: "Provide an `export model` or `nn export` command (e.g., `nn export --list`, `nn export --all`, `nn export <ModelName>`) to scan models, check template lineage, and auto-generate or update self-contained console artifacts using the canonical blueprint and data contracts."
  approach:: "Create an orchestrator script in Node.js that scans models, extracts frontmatter and data contracts, and compiles them against `artifact_blueprint.html`."
  notes:: "Implemented 2026-09-11: scripts/export-console.mjs (`nn export <root> [--list|--all|<name>]`). Direct fs scan (no core dependency — dist barrel not ESM-importable), fills innfo-config/schema/model slots against artifact_blueprint.html, vendors innfo-console.bundle.js."
  suggested_trigger:: "/sdd-explore console-artifact-export-cli"
  sources:: ["sources/nn/backlog.md"]
## NN WorkItem: On-the-fly OpenCode prompt generator
  number:: 21
  key:: "feature/opencode-prompt-generator"
  title:: "On-the-fly OpenCode prompt generator modal with custom notes & clipboard copy"
  type:: "functional"
  size:: "medium"
  priority:: "P2"
  status:: "done"
  why:: "Users need an easy, frictionless way to pass a specific prompt with full contextual metadata and custom instructions to OpenCode directly from any part of the iNNfo app."
  behaviour:: "Provide a quick action button on elements, concepts, and models opening a modal with a textarea for custom AI instructions, generating a structured prompt combining item context and user notes, copying to clipboard with confirmation, and previewing."
  approach:: "Build reusable prompt generator utility, implement modal component with textarea and clipboard copy actions, and add test coverage."
  suggested_trigger:: "/sdd-explore opencode-prompt-generator"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: innfo:// custom URI protocol and deep-linking parser
  number:: 22
  key:: "feature/innfo-uri-protocol-someday-maybe"
  title:: "innfo:// custom URI scheme and deep-linking parser"
  type:: "functional"
  size:: "medium"
  priority:: "P3"
  status:: "deferred"
  why:: "The iNNfo ecosystem can benefit from a native internal URI scheme (innfo://) and deep-linking mechanism for cross-referencing models, elements, and procedures across workspaces, avoiding manual modal path pasting."
  behaviour:: "Define and implement the innfo:// custom URI scheme specification (innfo://model/<id>, innfo://element/<id>, innfo://procedure/<id>), wire custom URI interception and routing in innfo-editor and console/runtime views, and register the OS-level custom protocol handler."
  approach:: "Establish a robust regex/parser utility in innfo-core to parse innfo:// URIs, intercept click events on matching anchors in innfo-editor and static consoles, and route them to the internal model navigation engine."
  suggested_trigger:: "/sdd-explore innfo-uri-protocol"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: Dev process hardening
  number:: 19
  key:: "chore/dev-process-hardening"
  title:: "Dev to main miscellany: gate parity, CI on dev, guards"
  type:: "chore"
  size:: "medium"
  priority:: "P1"
  status:: "done"
  why:: "The batched dev to main merge shipped red because dev has no CI, so batch commits stay unverified until the merge; the local pre-push gate did not mirror CI (no coverage ratchet, no check:spec-urls, gitignored-file blind spot); a generated manifest was hand-edited; and mojibake slipped into a tracked file."
  approach:: "Priority order: (1) run CI on dev; (2) wire the manifest generator/validator/parity tests into verify.js; (3) fail on U+FFFD in tracked text files; (4) local gate parity (build:docs, app build, innfo-mcp typecheck); (5) make check-spec-version collectFiles git-aware; (6) add a main-CI-green DoD to nn-dev-development and nn-dev-release; (7) add a Console subsystem to nn-dev-release and document the -v tag shape; (8) extract a shared rmWithRetry test helper; (9) worktree or wip-commit isolation for concurrent sessions; (10) root the MCP at the workspace (or add a per-call root to apply_change) so workspace models can be mutated deterministically instead of by hand."
  notes:: "All items done (2026-09-11): (1) CI on dev wired with --release gated to main; (2)(3)(4)(5)(8) manifest suites + tracked-text guard + coverage/spec-url in local gate + git-aware spec scan + rmWithRetry helper; (6) main-CI-green DoD added to both skills; (7) Console subsystem + -v tag shape in nn-dev-release; (9) wip: commit convention in nn-dev-development §1e; (10) apply_change now accepts per-call root override."
  also_consider:: "Items 1 and 2 are the highest return; 3 to 5 are cheap guards."
  suggested_trigger:: "/sdd-explore dev-process-hardening"
  sources:: ["sources/nn/backlog.md"]

## NN WorkItem: Identifier migration
  number:: 23
  key:: "refactor/identifier-migration"
  title:: "Mechanical identifier migration (template to app identifiers)"
  type:: "refactor"
  size:: "large"
  priority:: "P3"
  status:: "backlog"
  why:: "The user-facing vocabulary pass made app canonical and kept resolution-bearing identifiers stable as documented deprecated aliases; the actual identifier migration is intentionally deferred because paths, URLs, tool names, manifest keys and version tags all carry resolution semantics."
  behaviour:: "Mechanically migrate the identifiers recorded in `iNNfo/specs/vocabulary.json` under `terms.app.planned_migrations`: `specs/templates/ -> specs/apps/`, MCP tool names (e.g. `get_template`), the manifest `templates:` key, and `templates-v*` tags — with a coordinated alias/version strategy so existing pins keep resolving."
  approach:: "Follow the deprecation lifecycle from the canonical-vocabulary dictionary; sequence after the user-facing rename; never a blind find-and-replace. Requires coordinated updates across catalog, manifest/source.yaml, `_spec_NN.md` parent pointers, hydration paths, and the editor resolver constants."
  risks:: "Large; touches resolution across editor, MCP and skills. Do not attempt as one change; reuse the planned_migrations list as the checklist."
  suggested_trigger:: "/sdd-explore identifier-migration"
  sources:: ["sources/nn/backlog.md"]

# NN matrices: work-item relations
| Row \ Col | New templates | Silent fallbacks sweep | Metrics scenario compare | Console domain renderers | Pending tree closeout | Vocabulary simplification |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| MCP hygiene | - | related | - | - | - | - |
| Vocabulary simplification | related | - | - | - | - | - |
| Metrics scenario compare | - | - | - | related | - | - |
| Console domain renderers | - | - | - | - | related | - |
| New templates | - | - | - | - | - | depends_on |
| Local specialization migration | - | - | - | - | - | depends_on |

# NN matrices: item-markers matrix
| Item \ Marker | ready |
| :--- | :---: |
| Source import guards | X |
| KB change governance | X |
| Vocabulary simplification | X |
| Core structure | X |
| MCP hygiene | X |
| Trannsform slug codegen | X |
| Silent fallbacks sweep | X |
| Editor tech debt | X |
| Build hygiene | X |
| New templates | X |
| Metrics scenario compare | X |
| Workspace KB perf limits | X |
| Local specialization migration | - |
| Console domain renderers | - |
| Pending tree closeout | - |
