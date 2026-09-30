# Public Web Distribution

## Purpose

Define the split-hosting contract: which artifacts are published publicly, the one-way
pipeline that produces them from the private monorepo, and the invariant that the private
repository remains the single source of truth.

## ADDED Requirements

### Requirement: Public Distribution Repository

A dedicated public repository MUST hold the published website and the canonically hosted
specifications, templates and bundles. Its contents MUST be build output only and MUST
NOT contain hand-authored source that exists nowhere else.

#### Scenario: Published tree is generated
- GIVEN the public repository
- WHEN its contents are compared with a fresh `build-docs` output from the private repo
- THEN every file matches, with no extra hand-edited source

### Requirement: One-Way Publish Pipeline

The private monorepo MUST build the site and publish the artifact to the public
repository through a single automated path. The public repository MUST NOT write back to
the private one, and the publish MUST use a credential scoped to the single public
repository.

#### Scenario: Publish on build
- GIVEN a successful `build-docs` on the private repo
- WHEN the publish job runs
- THEN the built artifact is pushed to the public repository
- AND the publish credential is scoped to that repository only

#### Scenario: No reverse writes
- GIVEN the public repository
- WHEN it changes
- THEN no automated path writes back to the private monorepo

### Requirement: Public Site Availability

The public repository MUST deploy GitHub Pages so `cognnitive.com` serves the built site
independently of the private repository's visibility.

#### Scenario: Site serves while source is private
- GIVEN the private monorepo is private
- WHEN `cognnitive.com` is requested
- THEN the site is served from the public repository

### Requirement: Idempotent Publish

Publishing MUST be a no-op when the built artifact is byte-identical to what the public
repository already holds.

#### Scenario: Unchanged artifact
- GIVEN the public repo already holds the current artifact
- WHEN the publish job runs again
- THEN no commit is created

### Requirement: Private Source Remains SSOT

The private monorepo MUST remain the only place where the website and specifications are
edited. Canonical artifact URLs MUST keep resolving without authentication after the
repository becomes private.

#### Scenario: Canonical URLs resolve unauthenticated
- GIVEN the private repo is private and the site is published
- WHEN any canonical URL for a specification, template or bundle is requested without credentials
- THEN it resolves to the published artifact
