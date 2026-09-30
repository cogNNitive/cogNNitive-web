# Technical Design: Session-Start External Watch Root Digest

## 1. Technical Approach & Architecture Decisions

| Area | Decision | Rationale |
| :--- | :--- | :--- |
| **Ownership** | `nn-trannsform` owns classification + the state store; `nn-start` owns the prompt; the state file is the contract | The scanner already classifies changes; the front controller already owns session governance. |
| **Trigger** | One check in `nn-start` §1 (Environment Readiness), surfaced in §2 governance | Session start is where "check for me" belongs. |
| **Transport of the scan result** | Stable JSON from `--scan-external --json` (add the flag if missing) | The agent renders; it must not parse human prose. |
| **Decision persistence** | `.cognnitive/watch-digest.json`, keyed by `(root, relpath, sha256)` | Content-addressed, so the same bytes never nag twice; folder-local, so it travels with the workspace. |
| **Default** | `postpone` | Absence of a decision must never destroy or duplicate anything. |
| **Degradation** | Silent no-op | Session start must never depend on the digest. |
| **De-dup with `nn-innfo` §15** | Both read the same state file | One user, one prompt. |

## 2. Data Flow

```
session opens in a domaiNN
        │
        ▼
nn-start §1 ── does the manifest declare '## NN External Watch Roots:'?
        │                         │ no ──► nothing happens; session continues
        │ yes
        ▼
node skills/nn-trannsform/scripts/index.js --scan-external --json
        │         (fast path: mtime+size; hashes only changed files)
        ▼
classify: NEW | EVOLVED_DYNAMIC | STATIC_ALERT | DISCONNECTED
        │
        ▼
filter against .cognnitive/watch-digest.json (drop ignored/imported hashes)
        │
        ▼
render one digest: [a] ignore  [b] postpone  [c] import   (per item / bulk)
        │
        ▼
persist decision ──► import runs the existing timestamped ingestion
```

## 3. Interfaces & Contracts

### 3.1 Scan result (stable JSON)
```json
{
  "generatedAt": "2026-09-30T12:00:00Z",
  "roots": [
    { "root": "D:/External_Drops/Client_Inputs", "status": "ok",
      "items": [
        { "relPath": "q3_report.xlsx", "sha256": "…", "mtimeMs": 1750000000000, "size": 41234,
          "status": "NEW" },
        { "relPath": "rates.csv", "sha256": "…", "mtimeMs": 1750000000000, "size": 2210,
          "status": "EVOLVED_DYNAMIC" }
      ] }
  ]
}
```

### 3.2 Digest state file — `.cognnitive/watch-digest.json`
```json
{
  "version": 1,
  "items": {
    "D:/External_Drops/Client_Inputs::q3_report.xlsx::<sha256>": {
      "status": "ignored",
      "decidedAt": "2026-09-30T12:03:00Z",
      "note": ""
    }
  }
}
```
- Key: `<root>::<relPath>::<sha256>`. A new `sha256` is a new item, so an edited file is
  re-offered; an unedited one is not.
- Statuses: `ignore` | `postpone` | `import`. `postpone` items are re-offered;
  `ignore` / `import` are suppressed.

### 3.3 Skill frontmatter diffs
- `nn-start`: add the digest step to §1 and a governance note to §2; bump `version`,
  `last_updated`.
- `nn-trannsform`: document `--scan-external --json` and the state file; bump
  `version`, `last_updated`.
- `nn-innfo` §15: add one sentence — the pre-authoring prompt consults
  `.cognnitive/watch-digest.json` and skips already-decided items.

## 4. File Changes

| File Path | Description of Changes |
| :--- | :--- |
| `skills/nn-trannsform/scripts/lib/watch-digest-store.js` | New: read/write/prune the state file; key builder; idempotent upsert. |
| `skills/nn-trannsform/scripts/lib/watch-digest-store.test.js` | New: unit tests (keying, ignore/postpone/import, idempotence). |
| `skills/nn-trannsform/scripts/index.js` | `--scan-external --json` output; wire the state store; `--digest-decide`. |
| `skills/nn-start/SKILL.md` | Session-start digest step (governance) + frontmatter bump. |
| `skills/nn-innfo/SKILL.md` | §15 reads the shared state; frontmatter bump. |
| `.gitignore` (workspace template) | Ignore `.cognnitive/`. |
| `docs/innfo/documentation/import-modes.md` | Document the session-start digest and the three decisions. |

## 5. Testing Strategy

1. **Unit — `watch-digest-store.test.js`** (TDD first):
   - Key builder is `(root, relPath, sha256)` and stable across runs.
   - `ignore` suppresses the same hash and does **not** suppress a new hash.
   - `postpone` is re-offered on the next read.
   - `import` marks the item and does not re-offer it.
   - Writing twice with the same input is byte-idempotent.
2. **Unit — scanner JSON**: `--scan-external --json` emits valid JSON with the
   classification statuses and root status.
3. **Behavioural (skill contract)**: with no roots the digest produces no output; with a
   disconnected root, session start reports it and continues.
4. **Gates per phase**: `npm run lint`, `npm run typecheck`, the `nn-trannsform`
   suite; full gates (`node scripts/check-integrity.js`) at the tip.
   - Note: any change under `skills/**` requires a `skills-v*` tag + `manifest/source.yaml`
     re-pin in the same batch.

## 6. Migration

None. Additive: the state file is created lazily on the first decision; an absent
state file means "nothing decided yet". No existing workspace format changes.
