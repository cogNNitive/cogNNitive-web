# Technical Design: Source Convergence Strategies

## 1. Technical Approach & Architecture Decisions

| Area | Decision | Rationale |
| :--- | :--- | :--- |
| **Convergence seam** | Sources stay immutable; the *model* converges | A source is a citation target; mutating it rewrites the meaning of every existing citation. |
| **Proposal, not mutation** | `--converge` emits a read-only proposal; applying is a separate reviewed step | Keeps one write path (the reviewed model mutation) and keeps the scanner non-mutating. |
| **Identity** | A required `key` for non-default strategies | Without a stable key there is no safe upsert; abort instead of guessing. |
| **Apply path** | Reuse the feedback apply loop (`apply_change` + `validate_model` + one bump) | Same review contract as reviewer feedback; no new mutation authority. |
| **Idempotence** | Key the proposal against the two snapshot hashes; a proposal records the applied target version | Re-running is a no-op; an already-applied proposal is empty. |
| **Determinism** | Stable ordering of added/changed/removed lists | Byte-identical proposals for identical inputs. |

## 2. Data Flow

```
watch root / sources/import      (immutable snapshots, unchanged)
        │  new drop authored as <stem>_<YYYYMMDD-HHmmss>
        ▼
nn-trannsform --converge <family>
        │  1. resolve the two newest snapshots of the family
        │  2. read the declared convergence strategy + key
        │  3. keyed diff: added | changed | removed | conflicts
        ▼
   READ-ONLY proposal (Markdown + machine-readable summary)
        │
        ▼
agent: diff preview ──► user confirms ──► apply_change (per element) ──► validate_model
        │
        ▼
   model version bump (single) ──► proposal marked applied at target version
```

## 3. Interfaces & Contracts

### 3.1 Declared strategy (illustrative placement — open decision #1)
```markdown
## NN Source Family: YouTube Analytics Monthly
strategy:: upsert
key:: video_id
convergence_source:: sources/nn/import/youtube_analytics_2026-09_20260930-120000.md
```
- `strategy`: `cite-only` (default) | `upsert` | `replace-values`.
- `key`: required unless `cite-only`. Must resolve to a column (CSV/XLSX) or a field
  (JSON) that is unique and non-empty across the snapshot.

### 3.2 Delta proposal (stable, machine-readable)
```json
{
  "family": "youtube_analytics_monthly",
  "strategy": "upsert",
  "key": "video_id",
  "from": { "file": "…_20260831-235900.md", "sha256": "…" },
  "to":   { "file": "…_20260930-120000.md", "sha256": "…" },
  "added":    [ { "key": "abc123", "fields": { "views": "1200" } } ],
  "changed":  [ { "key": "def456", "field": "views", "from": "900", "to": "1500" } ],
  "removed":  [ { "key": "ghi789" } ],
  "conflicts":[ { "key": "jkl012", "field": "views", "reason": "duplicate_key" } ],
  "applied": null
}
```
- `removed` is **flag-only** by default (open decision #2).
- `conflicts` is non-empty only when the key is not unique/valid; a non-empty
  `conflicts` blocks the proposal (non-zero exit) and writes nothing.

### 3.3 CLI
```
node skills/nn-trannsform/scripts/index.js --converge <family> [--json] [--src <dir>]
```
- Exits `0` with a (possibly empty) proposal; exits non-zero when the key is missing,
  empty, or duplicated.
- Never writes to `sources/import/`, `sources/nn/`, or the model.

### 3.4 Skill frontmatter diffs
- `nn-trannsform`: document `--converge` and the strategy declaration; bump `version`,
  `last_updated`.
- `nn-innfo`: reference the convergence proposal from the apply procedure; bump
  `version`, `last_updated`.

## 4. File Changes

| File Path | Description of Changes |
| :--- | :--- |
| `skills/nn-trannsform/scripts/lib/convergence-delta.js` | New: keyed diff engine (added/changed/removed/conflicts), deterministic ordering. |
| `skills/nn-trannsform/scripts/lib/convergence-delta.test.js` | New: unit tests over two fixtures, key validation, idempotence. |
| `skills/nn-trannsform/scripts/index.js` | `--converge <family>` mode emitting the proposal; read the declared strategy. |
| `skills/nn-trannsform/SKILL.md` | Document the strategy declaration, `--converge`, and the read-only contract; frontmatter bump. |
| `skills/nn-innfo/SKILL.md` | Apply-procedure note for a convergence proposal (reuse the feedback apply loop); frontmatter bump. |
| `docs/innfo/documentation/import-modes.md` | Move convergence from roadmap to shipped. |

## 5. Testing Strategy

1. **Unit — `convergence-delta.test.js`** (TDD first):
   - Added keys, changed values, removed keys, and conflicts are reported against two
     fixtures.
   - Missing / empty / duplicate key → error, non-zero exit, no proposal.
   - Identical inputs produce a byte-identical proposal (idempotence).
   - `cite-only` (default) produces no proposal.
2. **Unit — no source mutation**: `--converge` leaves `sources/import/` and
   `sources/nn/` byte-unchanged.
3. **Behavioural**: applying a proposal (mock model) yields one version bump and a clean
   `validate_model`, reusing the feedback apply path.
4. **Gates per phase**: `npm run lint`, `npm run typecheck`, the `nn-trannsform` suite;
   full gates (`node scripts/check-integrity.js`) at the tip.
   - Note: any change under `skills/**` requires a `skills-v*` tag + `manifest/source.yaml`
     re-pin in the same batch.

## 6. Migration

None for existing workspaces: `cite-only` is the default, so every current source
family behaves exactly as today. Adopting `upsert` is opt-in per family.

## 7. Deferred / Follow-ups

- Conflict-resolution UX (when conflicts exist).
- Composite / multi-column keys (open decision #4).
- A rendered diff-preview artifact for the console.
