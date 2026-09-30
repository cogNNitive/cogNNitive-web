# Proposal: Public Web Repository Split

## Why

The `cogNNitive` monorepo is public today, and `docs/` is published to GitHub Pages at
`cognnitive.com` directly from it (`.github/workflows/ci.yml` `deploy-pages`, `docs/CNAME`).
The maintainer wants the source private while the website stays public. Two facts make
both a naive "flip the repo to private" and a naive "move `docs/` to a new public repo"
unsafe:

1. **`docs/` is generated output, not source.** `scripts/build-docs.mjs` builds
   `innfo-core`, `innfo-mcp` and `innfo-editor`, then stages the editor dist into
   `docs/innfo/app/`, the MCP CDN bundle into `docs/innfo/cdn/`, the template
   `catalog.json`, and the Docsify suites derived from `_NN.md` models. A public repo
   cannot build the site without the private source; it can only receive the built
   artifact.
2. **The ecosystem's canonical hosting base is the monorepo's raw URL.** Every
   specification, template, sample model and step bundle resolves against
   `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/...`, fixed by
   `openspec/specs/canonical-spec-hosting/spec.md` and enforced by `check:spec-urls`.
   Flipping the repo private silently breaks every unauthenticated consumer: external
   workspaces, the editor's `REMOTE_SPEC_BASE`, and the SHA-pinned `docs/use/manifest.md`
   agent bootstrap.

The goal is not "two repos" but a deliberate split: the private monorepo stays the single
source of truth and build authority; one public repository receives and serves only the
artifacts that are already public today.

## What Changes

- **A new public repository (e.g. `cogNNitive-web`)** hosts the published website and the
  canonically hosted specifications, templates and bundles. Its contents are build output
  only and are never hand-edited.
- **The private monorepo builds and publishes to it.** CI stages `build-docs.mjs` output
  and pushes it to the public repository, which owns the Pages deployment. The monorepo
  stops serving Pages from itself.
- **The canonical hosting base URL moves** off the private monorepo to the public
  distribution host, and all consumers are re-rooted in the same change:
  `REMOTE_SPEC_BASE`, every spec frontmatter `url` / `parent_spec.url`,
  `manifest/source.yaml`, the SHA-pinned `docs/use/manifest.md`, the `docs/use-cases.*`
  deep links, and `check-spec-version.mjs --check-urls`.
- **The editor application source stays private.** Only its compiled dist ships publicly,
  which is already the case (`docs/innfo/app/assets/` and `docs/innfo/cdn/*.bundle.js` are
  gitignored build outputs).
- **Free-tier hosting.** A public site repository is what keeps the website published
  without a paid plan for Pages-on-private-repositories.

## Capabilities

### New Capabilities
- `public-web-distribution`: the split-hosting contract - what is public, the one-way
  build-to-publish pipeline from the private repo, the single public host, and the
  invariant that the private repo remains the source of truth.

### Modified Capabilities
- `canonical-spec-hosting`: the canonical raw/blob base URL changes from the monorepo to
  the public distribution host; the strict URL checker and its exclusions update to the
  new host.

## Impact

### Affected areas
- `.github/workflows/ci.yml` - `deploy-pages` becomes a publish-to-public-repo job; a
  credential (fine-grained PAT or deploy key) scoped to one repository.
- `scripts/build-docs.mjs` - output target and the publish seam.
- `openspec/specs/canonical-spec-hosting/spec.md` - base URL requirement.
- `iNNfo/apps/innfo-editor/src/config/samples.ts` - `REMOTE_SPEC_BASE`.
- `iNNfo/specs/**/*_NN.md` frontmatter, `manifest/source.yaml`, `docs/use/manifest.md`,
  `docs/use/manifest-next.md`, `docs/specifications.md`, `docs/use-cases.*` - re-rooted
  URLs.
- `scripts/check-spec-version.mjs` / `iNNfo/scripts/check-spec-version.mjs` - URL regex
  and exclusions.
- New public repository `cogNNitive-web` - site, specs, bundles, Pages config, `CNAME`.

### Verification
- Behavior: with the monorepo private, `cognnitive.com` still serves the site, and every
  canonical spec URL resolves unauthenticated.
- Behavior: `check:spec-urls` passes against the new host and fails on any residual
  monorepo raw reference.
- Unit: the publish step is a no-op when the built artifact is byte-identical (no empty
  commits).
- Security: the published artifact contains no secrets; the publish credential is scoped
  to the single public repository.

### Rollback
Revert the commits on `dev`. The monorepo can resume deploying Pages from itself if
`deploy-pages` is restored and the base URL reverted; no workspace format changes.

### Dependencies
- Supersedes the hosting direction of the archived `migrate-spec-hosting-to-monorepo`
  change; must reconcile with `canonical-spec-hosting`, `monorepo-release-manifest`, and
  `docs-derived-facts`.
- Requires a decision (open decision 4) on whether the split is warranted at all versus
  paying for Pages-on-private.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Flipping the repo private breaks raw spec/bundle URLs | Certain | Move the canonical base to the public host in the same coordinated change; `check:spec-urls` is the gate |
| Two sources of truth; the public repo is hand-edited | Med | Public repo holds generated output only; single publish path from private CI; a drift check |
| Cross-repo publish credential is over-scoped | Med | Fine-grained PAT or deploy key scoped to one repository; rotate; never log it |
| Pinned-SHA manifest URLs break if publish rewrites history | Med | Publish append-only to the public repo; keep pinned SHAs valid |
| The split leaks more than today | Low | The published artifact is exactly what Pages already serves publicly today |

### Success criteria
- [ ] `cognnitive.com` serves the site while `cogNNitive` is private.
- [ ] Every canonical spec/template/bundle URL resolves unauthenticated at the new host.
- [ ] `check:spec-urls` is green and fails on any residual monorepo raw reference.
- [ ] The public repository contains only generated output; no hand-edited source.
- [ ] The publish credential is scoped to the single public repository.

### Out of scope
- Open-sourcing the editor app or any `iNNfo/` source.
- Changing the site's look, content, or generated-facts pipeline.
- Registering a second canonical host per artifact type.

### Open decisions

| # | Decision | Options |
|---|---|---|
| 1 | What the public repo contains | site only / site + canonically hosted specs / two repos (web + specs) |
| 2 | Canonical base URL target | public repo raw path vs same-origin Pages path |
| 3 | Publish mechanism | cross-repo push (PAT/deploy key) vs `gh-pages` branch vs reusable Actions workflow |
| 4 | Whether to split at all | private + paid Pages (no split) vs public web repo (split) |
| 5 | Editor app visibility | keep compiled-dist-only (unchanged) vs open-source the app |
