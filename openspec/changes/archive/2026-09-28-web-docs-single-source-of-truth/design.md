# Design: Web and Docs Single Source of Truth

## Technical Approach

A new, dedicated generator (`scripts/generate-docs-facts.mjs`) owns derived facts. It rewrites only **marker-delimited regions** inside two owned files. It reads MCP tools from the built `innfo-mcp` dist and skills from `manifest/source.yaml`, using the existing `parseSourceYaml`. `generate-docsify-suite.mjs` stays generic. The iNNfo model stays hand-authored navigation, and a set-equality guard keeps it honest. A second, independent generator (`scripts/generate-about-twin.mjs`) owns the whole-file `about.md` Markdown twin, mechanically derived from `about.html` (D6) — no markers, no shared region contract with `docs-facts.mjs`, since it replaces the entire file body rather than a region inside a hand-authored page.

## Architecture Decisions

| # | Question | Options | Tradeoff | Decision |
|---|----------|---------|----------|----------|
| D1 | Skills data into `documentation_NN.md` | (a) cross-read at generation; (b) include syntax in the model; (c) generated section inside the model | (b) iNNfo has no include syntax, and adding one needs a new spec version (published specs are write-once). (c) Machine-rewriting a hand-authored iNNfo model mixes authorship, and the parser treats marker lines as entity body text. (a) inside `generate-docsify-suite` couples a generic tool (it also builds the iNNfo site) to one site | **(a), in a dedicated script.** Versions and descriptions never live in the model; they render into README's catalog region. The model's `Canonical Skills` Page set MUST equal the `source.yaml` skill set, or the run fails (exit 2) |
| D2 | Reuse which parsers | New YAML parser vs `parseSourceYaml`; `innfo-core` parser vs `parseNNModel` | `parseNNModel` is what builds the sidebar, so the guard and the sidebar cannot disagree | Reuse `parseSourceYaml` (CJS, via `createRequire`). Export `parseNNModel` from `generate-docsify-suite.mjs` and wrap its top-level `run()` in an is-main guard (today, importing it calls `process.exit`) |
| D3 | MCP tool facts source | Import the dist; parse `server.ts` statically; emit JSON from the MCP build | Static TS parsing is brittle (nested schemas, quoted descriptions). A JSON artifact adds a docs coupling inside the iNNfo package | **Import `iNNfo/packages/innfo-mcp/dist/server.js`** (the package's `main`/`exports`). `build-docs.mjs:25` builds it before any docs step. Importing it has no side effects: stdio only starts when `isDirectRun` is true (`server.ts:790`). If the file is missing: exit 2 and name the path |
| D4 | Where generated facts live | Docsify `:include` fragment vs in-file markers | `:include` renders as a bare link on GitHub or in raw/LLM reads | HTML-comment regions in plain docs pages. A missing marker fails the run; it never appends |
| D5 | Drift check target | Working tree vs committed blob | CI runs `build:docs` **before** `verify.js` (`ci.yml:48-54`). If the build rewrites the regions, a working-tree `--check` can never fail | `build-docs.mjs` runs the generator in write mode, which satisfies "rebuild updates every surface". `verify.js` runs `--check --against HEAD`, comparing the render against `git show HEAD:<path>` |
| D6 | About page | (a) delete `about.md`, nothing replaces it; (b) generate `about.md` from `about.html` | `docs/skills/nn-site-generator/components/ai-readiness.md:21-23` documents a site-wide convention: every published HTML page carries a Markdown twin with the same content, no chrome. Deleting `about.md` breaks that convention for this one page and leaves `about.html:13`'s `<link rel="alternate" type="text/markdown">`, `llms.txt:9`, and `ai-index.yaml:21` pointing at a file that no longer exists | **(b), superseding the original decision.** `about.html` stays canonical; `about.md` becomes a generated twin (`scripts/generate-about-twin.mjs`), never hand-edited again. This is the smaller, convention-consistent change: three existing references keep working unmodified instead of needing repointing or removal |

## Data Flow

    innfo-mcp build ─→ dist/server.js ─(toolDefinitions)─┐
    manifest/source.yaml ─(parseSourceYaml)──────────────┼─→ lib/docs-facts.mjs (pure render)
    docs/skills/documentation/documentation_NN.md ─(parseNNModel)─┘   │ set-equality guard
                                                                         ▼
                   innfo-mcp.md [mcp-tools]   README.md [skills-catalog]

`build-docs.mjs` inserts the generator after the template-catalog staging (step 3b) and before the Docsify step (step 4).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/docs-facts.mjs` | Create | Pure functions: render regions, `replaceRegion`, `checkSkillPageSet`, `findHandTypedFacts` |
| `scripts/lib/docs-facts.test.mjs` | Create | Node test runner; picked up automatically by verify step 0b |
| `scripts/generate-docs-facts.mjs` | Create | CLI: write / `--check [--against HEAD]`. Exit 0 ok, 1 drift, 2 input failure |
| `scripts/generate-docsify-suite.mjs` | Modify | Export `parseNNModel`; is-main guard |
| `scripts/build-docs.mjs` | Modify | Call the generator (write mode) |
| `scripts/verify.js` | Modify | New step 7e: `--check [--against HEAD]` plus the literal scan |
| `docs/innfo/documentation/innfo-mcp.md` | Modify | Replace the hand-typed 9-row table with the `mcp-tools` region |
| `docs/skills/documentation/README.md` | Modify | `skills-catalog` region (count, name, version, description). The hand-typed Triggers column is dropped |
| `docs/skills/documentation/documentation_NN.md` | Modify | Page `nn-router` becomes `nn-start`; add `nn-video-script` |
| `docs/skills/documentation/skills/{nn-start,nn-video-script}.md` | Create/Rename | From `nn-router.md`; new page |
| `docs/skills/documentation/skills/*.md` | Modify | Drop `**Version**:` from headers |
| `docs/innfo/llms-full.txt` | Modify | Remove "seven semantic tools" |
| `docs/innfo/about.html` | Modify | Fix "seven semantic tools" wording before the twin is generated from it (Unit 5) |
| `scripts/generate-about-twin.mjs` | Create | CLI: write / `--check [--against HEAD]`. Exit 0 ok, 1 drift, 2 input failure (D6) |
| `docs/innfo/about.md` | Modify (generated) | Regenerated from `about.html` by `generate-about-twin.mjs`; no longer hand-authored (D6) |
| `docs/innfo/{about.html:13, llms.txt:9, ai-index.yaml:21}` | No change | Already reference `about.md`, which still exists (D6) |

## Interfaces / Contracts

```md
<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->
...rendered...
<!-- /generated:mcp-tools -->
```

- The MCP render uses registry order: `**N** tools`, then a `| Tool | Description |` table. Pipes are escaped and whitespace is collapsed.
- The skills render uses `source.yaml` order. The count line comes from `skills.length`.
- The output is deterministic: no timestamps, LF line endings, one trailing newline (same as `normalizeOutput` in `generate-manifest.js`).
- `findHandTypedFacts` scans the git-tracked `docs/innfo/**` and `docs/skills/**` `.md`/`.txt` files at HEAD, excluding generated regions. It fails on:
  - `/\b(\d+|one|…|twenty)\s+(semantic\s+|MCP\s+)?tools\b/i`
  - any line that contains a registered skill name and `(?<!\w)V_\d+-\d+-\d+`

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Region replace, renders, set guard, literal scan, determinism (render twice) | Written test-first in `docs-facts.test.mjs` with fixture strings; no dist needed |
| Integration | Missing dist exits 2; `--check` against a stale fixture exits 1 | Spawn the CLI with a temp cwd |
| CI | Drift detection | verify step 7e, after `build:docs` |

## Migration / Rollout

No migration required. Delivery follows the proposal's work units 2, 3, 5 and 7.

## Open Questions

- [x] Landing-level `docs/skills/{index.md,llms.txt,llms-full.txt,ai-index.yaml,sitemap.xml,.well-known/ai-catalog.json}` still name `nn-router`. Fixed by hand in Unit 3 (task 3.10); automating this landing-level twin set is out of scope.
- [x] `about.html` advertises a markdown twin (the `nn-site-generator` ai-readiness convention). Resolved by superseding D6 in Unit 5: `about.md` is generated from `about.html` instead of being deleted, keeping the convention intact.
