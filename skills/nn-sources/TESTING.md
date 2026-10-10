# nn-sources — Testing

## Automated Tests (Zero-Dependency)

Unit tests cover `config.js`, `scanner.js`, `provenance.js`, `webImport.js`, `lib/bootstrap.js`, and `lib/conversations.js` using Node's built-in `assert`:

```bash
cd skills/nn-sources

# All unit tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (Windows, requires PowerShell)
npm run test:integration
```

Tests cover: config read/write/merge, format detection, file hashing, co-located sidecar generation (`<file>.<ext>_sidecar_NN.md`, bodyless for `md`/`csv`/`json`, idempotent re-runs and refresh on changed bytes), `--cognitivize` on a file and on a folder, dependency checking, HTML metadata extraction, recursive project bootstrap (subfolders preserved), write-once imports (UTC-suffixed family members, identical bytes deduplicated, nothing overwritten), lineage-record filesystem sync (# NN Sources from sidecars, # NN ModelRecords from kNNowledge/, # NN Artifacts from artifacts/, append-only # NN Procedures), `--lineage --check` drift validation, provenance model generation, and conversation lifecycle (silent reservation, Zero Discard retention, title suggestions, write-once promotion to sources/conversations/ with a co-located sidecar). Unit coverage also includes `scanner-converters.js` PDF text reflow (extraction-artifact cleanup, wrapped-line re-join, clause-heading promotion, page-number removal).

## Manual Test Guide

Follow these steps in order on a new project with OpenCode. Each step verifies a part of the skill. Mark ✅ when it passes.

---

## Setup

```bash
# Create a clean folder for testing
mkdir ~/Documents/trannsform-test
cd ~/Documents/trannsform-test
```

Create some test files inside:

**`report.txt`**
```
The organization had 45 active members in 2023.
Coverage reached 78% of the target population.
```

**`data.csv`**
```
name,age,role
Ana,34,Coordinator
Luis,28,Technician
```

**`presentation.docx`** (optional — only if you want to test docx)

---

## Test 1: Skill installation

**Instruction for OpenCode:**

> Install the `nn-sources` skill in my session. Look for it in `~/.agents/skills/nn-sources/SKILL.md` or in the `skills/nn-sources/` repository.

**Expected result:** OpenCode loads the skill successfully.

---

## Test 2: Project bootstrap

**Instruction for OpenCode:**

> Using the nn-sources skill, bootstrap a project with the files in the current folder as source. Project name: "test-docs".

**Expected result:**
- ✅ OpenCode creates the structure `test-docs/sources/import/`, `test-docs/sources/conversations/`, `test-docs/conversations/`, `test-docs/artifacts/`, `test-docs/kNNowledge/`, `test-docs/procedures/`
- ✅ `test-docs/.gitattributes` contains the line `* -text` (raw-byte hashes survive a checkout on any platform)
- ✅ Files are copied to `test-docs/sources/import/` (names unchanged, subfolders preserved)
- ✅ OpenCode reports no errors

---

## Test 3: Scan and format detection

**Instruction for OpenCode:**

> Run the scan on the `test-docs` project using the skill's CLI.

**Expected result:**
- ✅ OpenCode executes `node scripts/index.js --scan --src test-docs`
- ✅ Summary appears: "Discovered: X, Processed: Y, Skipped: Z"
- ✅ `test-docs/index.md` (semantic `# NN index`) is created
- ✅ `test-docs/<name>_cogNNitive_NN.md` (provenance model) is created with the Sources populated
- ✅ `test-docs/sources/import/report.txt_sidecar_NN.md` is created next to `report.txt` with the normalized text as its body and flat frontmatter (`source_file`, `sha256`, `size_bytes`, `source_format`, `normalized_at`, `normalized_by`)
- ✅ `test-docs/sources/import/data.csv_sidecar_NN.md` is created next to `data.csv` with the same frontmatter and no body (the CSV itself is the citation target)
- ✅ If the source files live in subfolders under `sources/import/`, each sidecar sits in the same subfolder as its raw file; no mirror tree exists and no raw file is moved or changed
- ✅ Running the scan a second time writes nothing new and the sidecars keep their `normalized_at`

---

## Test 4: Agent (LLM) transformation with citations

**Instruction for OpenCode:**

> I want to generate a summary of the project documents. Use the skill to do a "summary" type transformation.

**Expected result:**
- ✅ OpenCode asks which citation and export format to use
- ✅ You pick a format (e.g. Standard Markdown Footnotes)
- ✅ OpenCode generates a new write-once file `artifacts/[name]_<YYYYMMDDTHHmmssZ>.md`
- ✅ The file includes source citations in the chosen format (e.g., footnotes resolving into `sources/import/...`)

---

## Test 5: Transformation — no sources

**Instruction for OpenCode:**

> Now generate a clean version of the same summary with no source references.

**Expected result:**
- ✅ OpenCode asks which citation and export format to use
- ✅ You pick `[i] No sources`
- ✅ OpenCode generates a new `artifacts/[name]_<YYYYMMDDTHHmmssZ>.md` (the earlier output is untouched)
- ✅ The file has no citation markers, reference list, or lineage markers

---

## Test 6: Traceability verification (only if docx/pdf present)

If you have a docx or pdf file in the source folder, when running the scan:

- ❓ Does the format diagnostic panel appear?
- ❓ Does OpenCode ask if you want to process it with Node.js or skip it?
- ❓ If you choose Node.js, does it install the dependency automatically?

---

## Test 7: Import from the web

**Instruction for OpenCode:**

> Import this URL into test-docs: `<some URL to an HTML page or PDF>`

**Expected result:**
- ✅ OpenCode runs `node scripts/index.js --import-url "<url>" --scan --src test-docs`
- ✅ The downloaded file appears under `test-docs/sources/import/` with a UTC suffix (`<name>_<YYYYMMDDTHHmmssZ>.<ext>`; extension inferred from `Content-Type`, falling back to the URL)
- ✅ After the scan, the file's sidecar (`<name>_<stamp>.<ext>_sidecar_NN.md`) includes `source_url` and `downloaded_at` in its frontmatter
- ✅ Repeating the import of unchanged content reports it as already imported and writes no new file
- ✅ For an HTML page, `title`/`description`/`author` appear in the sidecar frontmatter when discoverable
- ✅ For a PDF, the existing `.pdf` handling (pdf-parse) runs and, if present, `info.Title`/`info.Author` populate `title`/`author`

---

## Test 8: Conversation lifecycle & promotion

**Instruction for OpenCode:**

> Promote the active conversation transcript to sources/conversations as a full transcript.

**Expected result:**
- ✅ Transcript is saved under `conversations/YYYY-MM-DD_<slug>.md`
- ✅ Full transcript is generated at `sources/conversations/<slug>_<YYYYMMDDTHHmmssZ>.md` (write-once; promoting identical content again writes nothing)
- ✅ Its co-located bodyless sidecar `<slug>_<YYYYMMDDTHHmmssZ>.md_sidecar_NN.md` records `source_type: conversation_transcript`

---

## Results Summary

| Test | Description | Result |
|------|-------------|--------|
| 1 | Skill installation | — |
| 2 | Project bootstrap | — |
| 3 | Scan and detection | — |
| 4 | Transformation with citations | — |
| 5 | Transformation — no sources | — |
| 6 | Traceability (if applicable) | — |
| 7 | Import from the web | — |
