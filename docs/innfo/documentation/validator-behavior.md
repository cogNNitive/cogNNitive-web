# Validator Behavior

Validation is **deterministic**: the same input produces the same diagnostics. Two
knobs shape what a run reports — a baseline that suppresses known errors, and
severities that decide whether a diagnostic fails the run.

---

## Deterministic diagnostics

- A diagnostic carries a severity of `error`, `warning`, or `info`
  (`innfo-core/src/types/validation.ts`).
- `Diagnostics` (`innfo-core/src/diagnostics.ts`) routes each diagnostic into an
  errors bucket or a warnings bucket by its severity. `info` lands in the warnings
  bucket but keeps `severity: 'info'` so reporters can tell it apart.
- **Only `error` fails validation.** `warning` and `info` never affect the
  `valid` flag.

---

## Differential validation (`baseline_path`)

Pass `baseline_path` to `validate_model` to compare the current run against a
versioned baseline of known errors. Only **new** errors surface in the main
output; known errors are suppressed and counted with a `backlog` link.

The core logic is a pure module, `innfo-core/src/validator/baseline.ts`:

| Export | Role |
| :--- | :--- |
| `normalizeBaselinePath` | Normalizes a file path to forward slashes so fingerprints are OS-stable. |
| `fingerprint` | Stable key: file path + diagnostic path + rule code + normalized message. |
| `loadBaseline` | Parses raw baseline content; `null`/empty → `null` (full output). |
| `diffNewOnly` | Partitions current errors into new vs. suppressed, and reports stale entries. |

Behavior:

- **Fingerprint stability.** Rewording a hint does not move the fingerprint; a
  code change does — rule codes are frozen once shipped.
- **Suppression + backlog.** With a baseline, suppressed errors are hidden from the
  main output and counted (`Suppressed N known error(s) (backlog: …)`).
- **Stale entries.** A baseline entry matching no current error is reported as
  `info` (`BASELINE_STALE`) and **never fails** validation.
- **No baseline → full output.** A missing file, no `baseline_path`, or empty
  content yields every error as new and nothing as stale.
- **Malformed baseline → hard error.** A present-but-invalid baseline throws
  `BASELINE_INVALID` rather than silently suppressing nothing.

---

## Version inference at scaffold time

`innfo-mcp/src/tools/init-model.ts` infers a new model's version from the resolved
**parent app's own `spec_version`**:

- Omitting `model_version` inherits the app's `spec_version`.
- An explicit `model_version` wins only when it does not contradict the inferred
  one.
- When both exist and differ, init refuses to write and returns
  `VERSION_MISMATCH` instead of emitting a differing version.

The document is validated before it is written. The write is gated on
`templateErrors.length > 0 || (templateResolved && !doc.valid)`, so a schema
failure aborts the write — **unless** the parent template could not be resolved
(`templateResolved === false`), in which case the frontmatter-only document is
still written and the failure is reported as a warning.

---

## Resolver: workspace-first, temp writes

`innfo-mcp/src/tools/resolver-node.ts` resolves a parent chain in a fixed order:

1. **Direct local read** — when the parent URL is a local path or `file://`
   URI, it is read directly.
2. **4-tier package resolution** (`resolveTemplatePackage`) — Tier 1 workspace
   package (`specs/templates/<base>/<version>/`), Tier 2 workspace flat
   (`specs/` + `templates/`), Tier 3 global cache, Tier 4 installed skills.
   There is no standalone local-`specs/` step ahead of this: the workspace
   `specs/` tree **is** Tier 2.
3. **OS temp cache** — a previous default run's fetched specs.
4. **Network** — download and hydrate.

Fetch-and-save writes go to the **OS temp directory by default**, not the
workspace:

- `defaultCacheDir()` returns `INNFO_CACHE_DIR` when set, otherwise
  `join(tmpdir(), 'innfo-specs')`.
- Setting `in_place: true` restores in-tree writes under `specs/`.

So a default run leaves the workspace tree clean; nothing is written into `specs/`
unless `in_place` is requested.

---

## Version numbers

Do not copy version strings from `specifications.md` — it can lag the code. Read
the authoritative version from `catalog.json` or the artifact's own frontmatter
(`spec_version`, `template_version`, `model_version`).
