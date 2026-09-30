# Specifications

The cogNNitive ecosystem defines four specification levels. Each level builds on the one below it.

## Level 0 — Meta-specification

The root of the chain. Defines structure, versioning (SemVer), and RFC 2119 key words for the entire ecosystem.

Every spec artifact under `specs/` is immutable and filename-encoded — there is no
mutable "latest" alias. A version bump always creates a new file; the table below
lists the current file for each spec.

| Spec | Source |
|------|--------|
| **defiNNition** V 0.1.0 | [`specs/defiNNition_V_0-1-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md) |
| defiNNe V 0.1.0 | Superseded — frozen predecessor (`specs/defiNNe_V_0-1-0_NN.md`) |

## Level 1 — Central specification

The **iNNfo** specification. Every model is a single `_NN.md` document with optional structural children — concepts, elements, fields, markers, and matrices.

The `status` frontmatter field on a spec file uses the `defiNNition` vocabulary
`Draft | Stable | Deprecated`. `iNNfo_V_0-3-0` is the adopted L1 (`status: "Stable"`).
The **adopted** version is defined by `DEFAULT_INNFO_VERSION` in
`apps/innfo-editor/src/utils/constants.ts`, not by mutating older spec files:
`iNNfo_V_0-2-2_NN.md`, `iNNfo_V_0-2-1_NN.md`, `iNNfo_V_0-2-0_NN.md` and `iNNfo_V_0-1-0_NN.md` are immutable and keep whatever
`status` they were published with; they are simply no longer the default, and stay
resolvable forever for models authored against them.

| Spec | Role | Source |
|------|------|--------|
| **iNNfo** V 0.3.0 | Adopted (`status: "Stable"`) | [`specs/iNNfo_V_0-3-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md) |
| iNNfo V 0.2.2 | Superseded — frozen, still resolvable | [`specs/iNNfo_V_0-2-2_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md) |
| iNNfo V 0.2.1 | Superseded — frozen, still resolvable | [`specs/iNNfo_V_0-2-1_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md) |
| iNNfo V 0.2.0 | Superseded — frozen, still resolvable | [`specs/iNNfo_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md) |
| iNNfo V 0.1.0 | Superseded — frozen, still resolvable | [`specs/iNNfo_V_0-1-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md) |

## Level 2 — Apps

Domain-specific apps. Each declares concepts, markers, matrices, and relationship types for a specific domain, and its own `template_version` (independent of `spec_version`, which tracks L1 compliance). All apps are L1-compliant with `iNNfo_V_0-2-1`. `business_V_0-2-0` is a pure composite that `includes` `business-model` + `analysis`; `analysis` and `business-model` are first-revision apps carved out of the former monolithic `business` app, so they carry `spec_version: V_0-2-0` with `template_version: V_0-1-0`.

| App | `template_version` | Source |
|----------|--------------------|--------|
| **Blank** | V_0-2-0 | [`specs/templates/blank/blank_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/blank/blank_V_0-2-0_NN.md) |
| **Business** (composite) | V_0-2-1 | [`specs/templates/business/business_V_0-2-1_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-1_NN.md) |
| **Business Model** | V_0-1-0 | [`specs/templates/business-model/business-model_V_0-1-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/business-model/business-model_V_0-1-0_NN.md) |
| **Analysis** | V_0-1-0 | [`specs/templates/analysis/analysis_V_0-1-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/analysis/analysis_V_0-1-0_NN.md) |
| **Innovation** | V_0-2-0 | [`specs/templates/innovation/innovation_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/innovation/innovation_V_0-2-0_NN.md) |
| **cogNNitive** | V_0-2-0 | [`specs/templates/cogNNitive/cogNNitive_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/cogNNitive/cogNNitive_V_0-2-0_NN.md) |
| **Organization** | V_0-2-0 | [`specs/templates/organization/organization_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/organization/organization_V_0-2-0_NN.md) |
| **Procedures** | V_0-2-0 | [`specs/templates/procedures/procedures_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md) |
| **Projects** | V_0-2-0 | [`specs/templates/projects/projects_V_0-2-0_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/projects/projects_V_0-2-0_NN.md) |
| **Video** | V_0-3-2 | [`specs/templates/video/spec_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/video/spec_NN.md) |

Each app's `_V_0-1-0_` file (where one existed) stays frozen and resolvable for models still pinned to it.

## Level 3 — Sample models

Concrete data instances. Lightweight — just data and a parent pointer to their app. Each sample stays pinned to the app version it was authored against; a `_V_0-1-0_` sample remains valid after the adoption.

| Model | App | Source |
|-------|----------|--------|
| **Ghostbusters** | business V_0-2-1 | [`specs/templates/business/samples/Ghostbusters_V_0-2-1_business_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/business/samples/Ghostbusters_V_0-2-1_business_NN.md) |
| **Ghostbusters** | business V_0-2-0 | [`specs/templates/business/samples/Ghostbusters_V_0-2-0_business_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/business/samples/Ghostbusters_V_0-2-0_business_NN.md) |
| **Ghostbusters** | business V_0-1-0 | [`specs/templates/business/samples/Ghostbusters_V_0-1-0_business_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/business/samples/Ghostbusters_V_0-1-0_business_NN.md) |
| **Ghostbusters** | analysis V_0-2-0 | [`specs/templates/analysis/samples/Ghostbusters_V_0-2-0_analysis_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/analysis/samples/Ghostbusters_V_0-2-0_analysis_NN.md) |
| **Ghostbusters** | innovation V_0-2-0 | [`specs/templates/innovation/samples/Ghostbusters_V_0-2-0_innovation_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/innovation/samples/Ghostbusters_V_0-2-0_innovation_NN.md) |
| **Ghostbusters** | organization V_0-2-0 | [`specs/templates/organization/samples/Ghostbusters_V_0-2-0_organization_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/organization/samples/Ghostbusters_V_0-2-0_organization_NN.md) |
| **Ghostbusters** | procedures V_0-2-0 | [`specs/templates/procedures/samples/Ghostbusters_V_0-2-0_procedures_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/procedures/samples/Ghostbusters_V_0-2-0_procedures_NN.md) |
| **Ghostbusters** | projects V_0-2-0 | [`specs/templates/projects/samples/Ghostbusters_V_0-2-0_projects_NN.md`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/bluepriNNts/projects/samples/Ghostbusters_V_0-2-0_projects_NN.md) |

## Traceability & change propagation

The format spec (L0 `defiNNe` → L1 `iNNfo` → L2 apps) is consumed by every other
part of the project. What reads it, and how a change flows through:

| Consumer | How it reads the spec | Source |
|---|---|---|
| `@cognnitive/innfo-core` | Parses the parent chain, extracts app schema, validates models | `packages/innfo-core/src/resolver.ts`, `schema.ts`, `validator/` |
| `innfo-mcp` (MCP server) | Wraps core. Resolves local `specs/` first, then network `fetch`, then persists write-once into `specs/` | `packages/innfo-mcp/src/tools/spec.ts`, `resolver-node.ts` |
| `innfo-editor` (UI) | `resolveParentSpecs()` — workspace `specs/` handle → dev-only `/specs/…` → network. URLs built from one constant | `apps/innfo-editor/src/services/SpecResolverService.ts`, `utils/constants.ts` |
| Skills (`skills/nn-innfo`) | Delegates all resolution/validation to `innfo-mcp`; bundles a copy of `workspace_spec_NN` | `skills/nn-innfo/` |
| Bootstrap manifest | Pins skills and templates by `repo` + `path` + `version` + `commit`; CI validates | `docs/use/manifest.md` |
| Docs | Describe the resolver protocol and level system | `docs/innfo/documentation/ecosystem.md`, this page |

### Invariants

- **Immutable, filename-encoded.** Every file under `specs/` carries its version in the
  filename. A bump always creates a new file; a published file is never edited in place
  or deleted while a model still references it (`spec-versioning` R-SV-01/R-SV-02).
- **Single source of the version string.** `apps/innfo-editor/src/utils/constants.ts`
  (`DEFAULT_INNFO_VERSION`, `DEFAULT_TEMPLATE_VERSION`). No `.ts`/`.vue` file hardcodes the
  version elsewhere.
- **`parent_spec.url` pins a versioned filename** — never a mutable alias (R-SV-08).
- **Write-once persistence is the whole integrity guarantee** — nothing is silently
  replaced, so there is nothing to hash-verify (`spec-resolution` R-LSR-02).

### When a format spec changes

The mechanical procedure lives in the dev skill
`.agents/skills/nn-dev-spec-version-propagator/`; the canonical detection tool is
`scripts/check-spec-version.mjs` (`npm run check:spec-version` / `check:spec-urls`).

1. **New file.** Author `specs/…_V_x-y-z_NN.md` (SemVer per `defiNNe` §7). The old file stays.
2. **Engine.** Update `innfo-core` (parser / `schema.ts` / validator) and its fixtures.
   `innfo-mcp` inherits core; rebuild the bundle.
3. **Version constant.** Update `DEFAULT_INNFO_VERSION` / `DEFAULT_TEMPLATE_VERSION`.
4. **Sweep stale references.**
   `node scripts/check-spec-version.mjs --version <old> --check --by-type --with-skills`
   lists every doc, sample, test, fixture and skill file still on the old version — update each.
5. **URLs.** `npm run check:spec-urls` must stay green (also gated in CI, job `spec-integrity`).
6. **Apps.** Each L2 app must be compliant with the new L1. Apps that only
   exist at the old version must get a new-version file before the L1 can be made the default.
7. **Skills.** Sync any bundled copy under `skills/` (today: `workspace_spec_NN`) from
   the canonical file here. Bump `version` + `commit` in the bootstrap manifest
   (`docs/use/manifest.md`).
8. **Docs.** Update this page's tables and `ecosystem.md`.
9. **Existing L3 models are not migrated.** They keep resolving their old, immutable parent
   until an author repoints `parent_spec.url`. No silent fallbacks.

> **V_0-2-0 adopted (2026-09-01).** L1 `iNNfo_V_0-2-0` is `status: Stable` and is the
> value of `DEFAULT_INNFO_VERSION`. `iNNfo_V_0-1-0_NN.md` is immutable (R-SV-02) and
> unchanged — it is simply no longer the default. Every shipped L2
> app resolves at `iNNfo_V_0-2-0`. The V_0-2-0 rule changes (the four
> frontmatter-block forms `concepts:` / `markers:` / `matrices:` removed in favour of
> body-element definitions; `includes` duplicate-name entries with AST-identical bodies
> merged instead of erroring; `model` added to the `Concept Definition` and
> `Field Definition` `type` enums) are all in the engine. Existing L3 models pinned to
> `iNNfo_V_0-1-0` apps keep resolving unchanged.

## Related Standards

### Open Knowledge Format (OKF)

iNNfo is **compatible** with [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md), the Open Knowledge Format by Google Cloud Platform. Every iNNfo document is a valid OKF knowledge bundle.

| OKF Conformance Rule (Â§9) | iNNfo Status |
|---|---|
| Parseable YAML frontmatter on every non-reserved `.md` file | âœ… Satisfied — every `_NN.md` has required frontmatter |
| Non-empty `type` field in every frontmatter block | âœ… Satisfied — `level` + app name provides type semantics |
| Reserved filenames follow OKF conventions | âœ… Satisfied — `index.md` follows progressive-disclosure pattern |

**Why the compatibility holds:**

1. **Same substrate**: Both use Markdown + YAML frontmatter. OKF's "if you can `cat` a file, you can read OKF" applies to iNNfo verbatim.
2. **OKF tolerates extensions**: OKF explicitly allows unknown frontmatter keys and unknown `type` values. iNNfo's additional fields (`spec_version`, `level`, `parent`, `concepts`, `markers`, `matrices`) are fully tolerated.
3. **A directory of `_NN.md` documents = an OKF knowledge bundle**: a workspace of iNNfo models produces the exact directory-of-Markdown-files structure OKF defines as a knowledge bundle (Â§3). Each `_NN.md` is an OKF concept document (Â§4), with `index.md` as the directory listing (Â§6).
4. **Cross-linking**: OKF uses standard Markdown links; iNNfo supports wikilinks (`[[target]]`) and standard links — both work for cross-referencing concepts.

See the [Ecosystem page](ecosystem) for the full compatibility mapping.
