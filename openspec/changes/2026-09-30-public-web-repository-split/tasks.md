# Tasks: Public Web Repository Split

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600-1200 (the URL re-root sweep dominates) |
| 400-line budget risk | High (the re-root sweep touches many spec files) |
| Chained PRs recommended | Yes (3 slices: decide + scaffold -> publish pipeline -> URL re-root) |
| Delivery strategy | chained |
| Chain strategy | slice 1 resolves the open decisions and stands up the repo; slice 2 publishes; slice 3 re-roots and flips the base |

Decision needed before apply: Yes - open decisions 1-4 in `proposal.md`.
Chained PRs recommended: Yes
Chain strategy: decide/scaffold -> publish pipeline -> canonical URL re-root + private flip.

---

## Phase 0: Decision gate (blocking)

- [x] 0.1 Resolve open decisions 1-4 in `proposal.md`; record the chosen architecture in
      `design.md` and drop the "proposal-stage" status.
      — All 5 resolved: (1) one public repo with site + canonical specs; (2) canonical base =
      public repo raw path; (3) cross-repo push, append-only, repo-scoped PAT/deploy key;
      (4) split to `cogNNitive-web`; (5) editor stays compiled-dist-only. Recorded in
      `design.md` (status now "Decisions resolved").
- [x] 0.2 Confirm the GitHub plan and whether the split is needed versus Pages-on-private.
      — **Split on the free tier** (Pages-on-private rejected). Creating the public repo and
      the publish credential are maintainer actions (Phase 1).

## Phase 1: Stand up the public repository

- [ ] 1.1 Create `cogNNitive-web` (public); add `docs/CNAME`, Pages config, `.nojekyll`.
      `[public-web-distribution:Requirement:Public Distribution Repository]`
- [ ] 1.2 Add the publish credential (repo-scoped PAT or deploy key) as a secret in the
      private repo. `[public-web-distribution:Requirement:One-Way Publish Pipeline]`
- [ ] 1.3 **RED**: a test asserting the publish step is a no-op on identical artifacts
      (no empty commit). `[public-web-distribution:Requirement:Idempotent Publish]`

## Phase 2: Publish pipeline

- [ ] 2.1 **GREEN**: add the publish job to `.github/workflows/ci.yml`; stop
      `deploy-pages` from serving the monorepo. `[public-web-distribution:Requirement:One-Way Publish Pipeline]`
- [ ] 2.2 **GREEN**: parameterize the `build-docs.mjs` destination and stage into the
      publish tree. `[public-web-distribution:Requirement:Build Output Only]`
- [ ] 2.3 Verify: a push to `dev` publishes a byte-identical site; Pages serves
      `cognnitive.com`. `[public-web-distribution:Requirement:Public Site Availability]`

## Phase 3: Canonical URL re-root

- [ ] 3.1 **RED**: extend `check:spec-urls` with a failing test on the new base host and
      on a residual monorepo raw reference. `[canonical-spec-hosting:Requirement:Strict Repo-Wide Spec URL Checker]`
- [ ] 3.2 **GREEN**: re-root `REMOTE_SPEC_BASE`, spec frontmatter, `manifest/source.yaml`,
      `docs/use/manifest*.md`, `docs/specifications.md`, `docs/use-cases.*`.
      `[canonical-spec-hosting:Requirement:Editor Runtime Spec Base Constant]`
- [ ] 3.3 **GREEN**: update the strict checker regex and exclusions.
      `[canonical-spec-hosting:Requirement:Canonical Spec Hosting Base URL]`
- [ ] 3.4 Verify: `check:spec-urls` + `check-integrity` green; every new URL resolves
      unauthenticated.
- [ ] 3.5 Flip `cogNNitive` to private; confirm the site and the specs still resolve.
      `[public-web-distribution:Requirement:Private Source Remains SSOT]`
- [ ] 3.6 Absorb the `nn-nomenclature-commercial-web` copy refresh in the same sweep:
      update `docs/index.html`, `use-cases.html` / `use-cases.md`, the contact and legal
      pages, `llms.txt`, `ai-index.yaml`, and the sitemap if affected, so the public web
      files are rewritten once (hosting + nomenclature together).
      `[public-web-distribution:Requirement:Build Output Only]`

## Phase 4: Drift guard and docs

- [ ] 4.1 Add a check that the public repo holds only generated output (no hand-edited
      source). `[public-web-distribution:Requirement:Build Output Only]`
- [ ] 4.2 Document the split in `README.md` and the release / development skills.
