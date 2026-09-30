# External Watch Roots Session Digest Specification

## Purpose

Surface newly arrived or changed external primary sources **at session start**,
without the user having to ask for a scan, and let the user decide per item what to
do. The scanner, the immutable timestamped ingestion, and the impact check already
exist; this capability adds the session-start trigger, the digest rendering, the
three-way decision, and the persisted decision state.

## Requirements

### Requirement: Session-Start Digest

When a session opens inside a domaiNN whose manifest declares an
`## NN External Watch Roots:` section, the system MUST offer exactly one digest of
the changed items, each classified as `NEW`, `EVOLVED_DYNAMIC`, `STATIC_ALERT`, or
`DISCONNECTED`, and each offering three actions: `ignore`, `postpone`, or `import`.
The digest MUST be derived from the existing external scan; it MUST NOT introduce a
second scanning mechanism.

#### Scenario: New drop is surfaced at session start
- GIVEN a domaiNN declaring `## NN External Watch Roots:` with a `dynamic` root
- AND a new file appears in that root that was never ingested
- WHEN a session opens in the domaiNN
- THEN the digest lists the file as `NEW`
- AND offers `ignore` / `postpone` / `import` for it.

#### Scenario: No roots declared means no digest
- GIVEN a domaiNN that declares no external watch roots
- WHEN a session opens
- THEN no digest is produced
- AND session start is unchanged.

### Requirement: Decision Persistence & Idempotence

The system MUST persist each decision in a workspace-local state file keyed by
`(root, relative path, sha256)`. An `ignore` decision MUST suppress that exact content
permanently; a `postpone` decision MUST re-offer the item on the next session; an
`import` decision MUST mark the item as handled and not re-offer it. Writing the same
decision set twice MUST be byte-idempotent.

#### Scenario: Ignored content is never re-offered
- GIVEN an item whose `sha256` was marked `ignore`
- WHEN a later session scans the same unchanged file
- THEN the item is not offered again.

#### Scenario: Edited content is re-offered
- GIVEN an item previously marked `ignore`
- AND the file is edited so its `sha256` changes
- WHEN a later session scans the root
- THEN the item is offered again as a new decision point.

#### Scenario: Postponed items return
- GIVEN an item marked `postpone`
- WHEN the next session scans the root
- THEN the item is offered again.

### Requirement: Non-Blocking Degradation

The digest MUST never block or fail session start. If no roots are declared, the scan
is unavailable or offline, or a root is disconnected, the system MUST degrade to a
silent no-op (reporting a disconnected root, at most) and continue.

#### Scenario: Disconnected root does not block
- GIVEN a declared root that is no longer reachable
- WHEN a session opens
- THEN the digest reports the root as `DISCONNECTED`
- AND session start completes normally.

### Requirement: Zero Unilateral Mutation

Producing the digest, or deciding `ignore` or `postpone`, MUST NOT write to
`sources/import/` or `sources/nn/`. Only an explicit `import` decision MAY trigger the
existing immutable timestamped ingestion.

#### Scenario: Digest is read-only
- GIVEN any set of changed items
- WHEN the digest is produced and items are ignored or postponed
- THEN `sources/import/` and `sources/nn/` are byte-unchanged.
