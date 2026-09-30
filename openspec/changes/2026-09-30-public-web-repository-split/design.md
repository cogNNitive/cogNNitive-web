# Design: Public Web Repository Split

## Status

**Decisions resolved (Phase 0, 2026-09-30).** The architecture below is adopted; the
publish mechanism and the width of the URL re-root sweep are settled.

| # | Decision | Choice |
|---|---|---|
| 1 | What the public repo contains | **site + canonically hosted specs**, in ONE public repo (`cogNNitive-web`) |
| 2 | Canonical base URL target | **public repo raw path** (`https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/...`) — minimal re-root (repo-name swap); pinned SHAs stay valid |
| 3 | Publish mechanism | **cross-repo push**, append-only/fast-forward, with a **repo-scoped PAT or deploy key** |
| 4 | Whether to split | **split** to a free public web repo (Pages-on-private rejected) |
| 5 | Editor app visibility | **compiled-dist-only** (unchanged; source stays private) |

Consequence of #2: the re-root is a repository-name swap, so `check-spec-version.mjs`'s
exclusions extend to the private monorepo raw host and the checker's base host changes to
`cogNNitive-web`; no path-scheme change for consumers.

## Context and constraints

- `docs/` mixes authored pages (`index.html`, `legal.html`, `privacy.html`,
  `contact.html`, `use/*`, `use-cases.*`) with generated artifacts (editor app dist, CDN
  bundle, `catalog.json`, Docsify suites, `about.md`).
- The build is the authority: `scripts/build-docs.mjs` produces the generated half.
- The canonical hosting base is consumed by external, unauthenticated clients, so it
  cannot live behind a private repository.

## Recommended architecture

Three surfaces:

| Surface | Repo | Visibility | Contents |
|---|---|---|---|
| Source of truth | `cogNNitive` | private | all source, app, packages, scripts, RFCs |
| Public site + canonical host | `cogNNitive-web` | public | built site, specs/templates, bundles |
| Pages | GitHub Pages on `cogNNitive-web` | public | `cognnitive.com` |

Flow:

```
private cogNNitive
  -> CI: npm run build:docs   -> artifact (docs/)
     -> publish (push)        -> public cogNNitive-web (append-only)
        -> Pages deploy       -> cognnitive.com
```

## Seams

- **Build**: `scripts/build-docs.mjs` keeps its behavior; only its destination is
  parameterized.
- **Publish**: one job with a repository-scoped credential; fast-forward / append-only
  pushes so pinned SHAs stay valid.
- **Base URL**: a single constant for the canonical host; `REMOTE_SPEC_BASE` and
  `check-spec-version.mjs` derive from it. The strict scan's exclusion set extends to the
  monorepo raw host so the checker does not self-flag.
- **Generated-vs-authored split** (only if open decision 1 = site only): authored pages
  stay in a public source repo and generated pages are published into it. This is the one
  option where the public repo is independently authored rather than output-only.

## Non-goals

- Not a build move: the public repo never runs `npm ci` or the monorepo build.
- Not a docs redesign.

## Decision gates

- Publish mechanism (open decision 3) determines whether a stored credential or a
  reusable Actions workflow is needed.
- Base-URL target (open decision 2) determines how wide the re-root sweep is.
- Both must be settled before `tasks.md` is actionable.
