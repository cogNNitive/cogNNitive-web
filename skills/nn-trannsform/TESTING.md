# nn-trannsform — Testing

## Automated Tests (Zero-Dependency)

Unit tests cover `config.js`, `scanner.js`, `provenance.js`, `webImport.js`, `lib/bootstrap.js`, and `lib/conversations.js` using Node's built-in `assert`:

```bash
cd skills/nn-trannsform

# All unit tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (Windows, requires PowerShell)
npm run test:integration
```

Tests cover: config read/write/merge, format detection, file hashing, flat frontmatter generation (with mirrored subfolder output), dependency checking, HTML metadata extraction, recursive project bootstrap (subfolders preserved), lineage-record filesystem sync (# NN Models/# NN Artifacts from models/ + export/, append-only # NN Procedures, --check drift and archive validation), provenance model generation, source versioning archive snapshots (`sources/archive/`), and conversation lifecycle (silent reservation, trivial discard, title suggestions, promotion to sources/conversations/ and normalization to sources/nn/conversations/). Unit coverage also includes `scanner-converters.js` PDF text reflow (extraction-artifact cleanup, wrapped-line re-join, clause-heading promotion, page-number removal).

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

> Install the `nn-trannsform` skill in my session. Look for it in `~/.agents/skills/nn-trannsform/SKILL.md` or in the `skills/nn-trannsform/` repository.

**Expected result:** OpenCode loads the skill successfully.

---

## Test 2: Project bootstrap

**Instruction for OpenCode:**

> Using the nn-trannsform skill, bootstrap a project with the files in the current folder as source. Project name: "test-docs".

**Expected result:**
- ✅ OpenCode creates the structure `test-docs/sources/import/`, `test-docs/sources/conversations/`, `test-docs/sources/export/`, `test-docs/conversations/`, `test-docs/sources/nn/`, `test-docs/models/`, `test-docs/procedures/`, `test-docs/export/`, `test-docs/traNNsformations/`
- ✅ Files are copied to `test-docs/sources/import/`
- ✅ OpenCode reports no errors

---

## Test 3: Scan and format detection

**Instruction for OpenCode:**

> Run the scan on the `test-docs` project using the skill's CLI.

**Expected result:**
- ✅ OpenCode executes `node scripts/index.js --scan --src test-docs`
- ✅ Summary appears: "Discovered: X, Processed: Y, Skipped: Z"
- ✅ `test-docs/sources/nn/index.md` (ingestion manifest) is created
- ✅ `test-docs/index.md` (semantic `# NN index`) is created
- ✅ `test-docs/<name>_V_0-2-0_cogNNitive_NN.md` (provenance model) is created with the Sources populated
- ✅ `test-docs/sources/nn/import/report.md` is created with the txt content, with flat frontmatter (`source_file`, `sha256`, `size_bytes`, `normalized_at`, `normalized_by`)
- ✅ `test-docs/sources/nn/import/data.md` is created with the csv content
- ✅ If the source files live in subfolders under `sources/import/`, the same subfolders appear under `sources/nn/import/`

---

## Test 4: Agent (LLM) transformation — Draft

**Instruction for OpenCode:**

> I want to generate a draft summary of the project documents. Use the skill to do a "summary" type transformation in draft format.

**Expected result:**
- ✅ OpenCode asks you what type of transformation you want
- ✅ You choose "Create new" (or "Summary" if offered)
- ✅ OpenCode asks if you want draft or final version
- ✅ You choose "Draft"
- ✅ OpenCode generates a file `export/[name]_draft.md`
- ✅ The draft includes the header `# DRAFT FOR REVIEW — NOT FINAL VERSION`
- ✅ The draft includes source citations (e.g., `— Source: informe.txt`)
- ✅ If unsure about any data, it includes markers like `[unconfirmed data — review]`

---

## Test 5: Transformation — Final version

**Instruction for OpenCode:**

> Now generate a clean final version of the same summary.

**Expected result:**
- ✅ OpenCode asks if you want to include source references
- ✅ You answer yes (or no)
- ✅ OpenCode generates `export/[name]_v_0-1-0.md`
- ✅ The file has NO draft markers or annotations
- ✅ (Optional) Includes source references if you said yes

---

## Test 6: Traceability verification (only if docx/pdf present)

If you have a docx or pdf file in the source folder, when running the scan:

- ❓ Does the format diagnostic panel appear?
- ❓ Does OpenCode ask if you want to process it with Node.js or skip it?
- ❓ If you choose Node.js, does it install the dependency automatically?

---

## Test 7: CLI transformer fallback

**Instruction for OpenCode:**

> Run the CLI fallback transformer with `node scripts/index.js --apply Generic_Normalizer --src test-docs`. Place the template in test-docs/traNNsformations/ first.

**Expected result:**
- ✅ OpenCode runs the command
- ✅ `export/Generic_Normalizer_[timestamp].md` is generated

---

## Test 8: Import from the web

**Instruction for OpenCode:**

> Import this URL into test-docs: `<some URL to an HTML page or PDF>`

**Expected result:**
- ✅ OpenCode runs `node scripts/index.js --import-url "<url>" --scan --src test-docs`
- ✅ The downloaded file appears under `test-docs/sources/import/` (extension inferred from `Content-Type`, falling back to the URL)
- ✅ After the scan, the corresponding file in `test-docs/sources/nn/` includes `source_url` and `downloaded_at` in its frontmatter
- ✅ For an HTML page, `title`/`description`/`author` appear in the frontmatter when discoverable
- ✅ For a PDF, the existing `.pdf` handling (pdf-parse) runs and, if present, `info.Title`/`info.Author` populate `title`/`author`

---

## Test 9: Conversation lifecycle & promotion

**Instruction for OpenCode:**

> Promote the active conversation transcript to sources/conversations as a full transcript.

**Expected result:**
- ✅ Transcript is saved under `conversations/YYYY-MM-DD_<slug>.md`
- ✅ Full transcript is generated at `sources/conversations/YYYY-MM-DD_<slug>_source.md`
- ✅ Scan normalizes it to `sources/nn/conversations/YYYY-MM-DD_<slug>_source.md` with `source_type: conversation_transcript`

---

## Results Summary

| Test | Description | Result |
|------|-------------|--------|
| 1 | Skill installation | — |
| 2 | Project bootstrap | — |
| 3 | Scan and detection | — |
| 4 | Draft transformation | — |
| 5 | Final transformation | — |
| 6 | Traceability (if applicable) | — |
| 7 | CLI fallback | — |
| 8 | Import from the web | — |
