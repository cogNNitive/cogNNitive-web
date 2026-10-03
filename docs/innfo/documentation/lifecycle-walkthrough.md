# Knowledge Lifecycle Walkthrough (Ghostbusters Inc. Case Study)

This guide walks through the end-to-end **cogNNitive Knowledge Lifecycle** (`IMPORT` ➔ `MANAGE` ➔ `EXPORT` + Feedback Loop) using the canonical **Ghostbusters Inc.** universe.

You can inspect the entire sample workspace directly on disk or in the repository under [`docs/innfo/samples/lifecycle-ghostbusters/`](../samples/lifecycle-ghostbusters/).

---

## 1. Walkthrough Architecture at a Glance

```mermaid
flowchart LR
    subgraph P0["0. External World"]
        E["🧠 Egon & Ray (Brainstorm)"] -->|"Audio / SRT"| F1["containment_debrief.srt"]
        V["🧠 Peter Venkman (Strategy)"] -->|"Markdown Memo"| F2["commercial_pricing_memo.md"]
    end

    subgraph P1["1. IMPORT"]
        F1 & F2 -->|"Verbatim + SHA-256"| IMP["sources/import/"]
        IMP -->|"Intermediate Buffer"| STG["staging/"]
        IMP -->|"Cognitivize in place"| SC["<file>.<ext>_sidecar_NN.md"]
    end

    subgraph P2["2. MANAGE (iNNfo Model)"]
        SC -->|"sources:: [file.md@## Heading]"| M["kNNowledge/Ghostbusters_Operations_NN.md"]
    end

    subgraph P3["3. EXPORT & Feedback"]
        M -->|"Generate"| EXP["artifacts/Paranormal_Containment_Brief_<UTC suffix>.md"]
        EXP -.->|"EPA Inspector Review"| FB["sources/import/feedback/"]
        FB -.->|"Re-ingestion"| IMP
    end

    classDef p0 fill:#F4F4F6,stroke:#8E8E93,color:#1C1C1E;
    classDef p1 fill:#EBF3FF,stroke:#007AFF,color:#003D82;
    classDef p2 fill:#F6EEF6,stroke:#4D0E4E,color:#4D0E4E;
    classDef p3 fill:#E8F8F0,stroke:#34C759,color:#105C29;

    class E,V,F1,F2 p0;
    class IMP,STG,SC p1;
    class M p2;
    class EXP,FB p3;
```

---

## 2. Phase 0: External Knowledge Elicitation

Knowledge originates outside the software in human minds. The team creates digital files without changing their existing workflows:

* [**`containment_debrief.srt`**](../samples/lifecycle-ghostbusters/0_external_world/containment_debrief.srt): Subtitle transcript from an operational voice recording where Dr. Egon Spengler notes that the laser containment grid is running at **94% capacity** and Dr. Ray Stantz requests grid expansion.
* [**`commercial_pricing_memo.md`**](../samples/lifecycle-ghostbusters/0_external_world/commercial_pricing_memo.md): Strategic rate memo written by Dr. Peter Venkman establishing Manhattan commercial rates ($5,000 elimination + $1,000/mo storage) and hazardous slime surcharges ($1,500).

---

## 3. Phase 1: Ingestion & Normalization (`IMPORT`)

The raw files are imported into the workspace:

```text
workspace/
├── sources/
│   ├── import/
│   │   ├── containment_debrief.srt          # Immutable verbatim copy (SHA-256 tracked)
│   │   ├── containment_debrief.srt_sidecar_NN.md  # Co-located sidecar (normalized body)
│   │   ├── commercial_pricing_memo.md       # Immutable verbatim copy
│   │   └── commercial_pricing_memo.md_sidecar_NN.md  # Co-located sidecar (no body)
│   └── staging/
│       └── pke_audio_buffer.tmp             # Ephemeral transcription buffer (never cited)
```

Run the scanner:
```bash
node skills/nn-trannsform/scripts/index.js --scan --src "docs/innfo/samples/lifecycle-ghostbusters/workspace"
```

Each co-located sidecar carries flat, deterministic traceability frontmatter:
```yaml
---
level: 3
parent_spec:
  name: sidecar
source_file: "sources/import/commercial_pricing_memo.md"
sha256: "b4c2...f8a1"
size_bytes: 382
source_format: md
normalized_at: "2026-09-12T12:00:00Z"
normalized_by: "traNNsform v1.0.0"
---
```

---

## 4. Phase 2: Semantic Modeling (`MANAGE`)

With normalized sources available, the team structures the knowledge into an **iNNfo Level 3 Semantic Model** ([`models/Ghostbusters_Operations_V_1-0-0_NN.md`](../samples/lifecycle-ghostbusters/workspace/models/Ghostbusters_Operations_V_1-0-0_NN.md)):

```markdown
# NN ServiceTier

## NN ServiceTier: Standard Class IV Elimination
sources:: [sources/import/commercial_pricing_memo.md@## Manhattan Commercial Rates]
base_fee:: $5,000
monthly_storage:: $1,000
target_market:: Manhattan Commercial

Full spectral neutralization and physical containment for non-anchored entities.

# NN FacilityCapacity

## NN FacilityCapacity: Basement Containment Grid
sources:: [sources/import/containment_debrief.srt_sidecar_NN.md@## NN Section 000001]
status:: Critical Load (94%)
expansion_required:: true
laser_lock_frequency:: 14.8 MHz
```

### Citation Invariants
1. **Heading-level anchors**: Citations point directly to `@## <Heading>`, guaranteeing precision down to individual paragraphs.
2. **Auditability**: Running `node skills/nn-trannsform/scripts/index.js --check-impact` validates that all model pointers resolve accurately.

---

## 5. Phase 3: Deliverables & Closed-Loop Feedback (`EXPORT`)

The model produces client- and regulatory-facing deliverables:

1. **Generated Brief**: [**`export/Paranormal_Containment_Brief_V_1-0-0.md`**](../samples/lifecycle-ghostbusters/workspace/export/Paranormal_Containment_Brief_V_1-0-0.md) embeds lineage metadata:
   ```yaml
   ---
   type: deliverable
   derived_from: [Ghostbusters_Operations_V_1-0-0_NN]
   exported_at: "2026-09-12T12:00:00Z"
   ---
   ```
2. **Human Review Loop**: Walter Peck (EPA) reviews the document and submits structured feedback ([`sources/import/feedback/...json`](../samples/lifecycle-ghostbusters/workspace/sources/import/feedback/Ghostbusters_Operations_V_1-0-0_epa-review_feedback_20260912-120000.json)).
3. **Re-ingestion**: The scanner cognitivizes the feedback JSON in `sources/import/feedback/` in place, allowing the agent to guide interactive model updates via `reconcile_feedback`.

---

## 6. Dynamic Sources & Impact Checking (Drift Detection)

When an existing source changes over time:
1. **Source Update**: If Dr. Peter Venkman updates `commercial_pricing_memo.md` (e.g. renaming `## Manhattan Commercial Rates` to `## Downtown Commercial Rates`).
2. **New Family Member**: `--scan` imports the changed file as a new write-once member; the previous member keeps its immutable bytes and co-located sidecar.
3. **Scan Warning**: The terminal immediately alerts:
   ```text
   ⚠️  [IMPACT WARNING] A newer member of "sources/import/commercial_pricing_memo" affects downstream models:
       - kNNowledge/Ghostbusters_Operations_NN.md (Standard Class IV Elimination): cites "commercial_pricing_memo.md@## Manhattan Commercial Rates" [unit_missing_in_latest]
   ```
4. **On-Demand Audit**: Running `node skills/nn-trannsform/scripts/index.js --check-impact` highlights the exact missing citation and suggests the closest matching heading:
   ```text
   ❌ kNNowledge/Ghostbusters_Operations_NN.md (Standard Class IV Elimination): references missing heading "## Manhattan Commercial Rates" in "sources/import/commercial_pricing_memo_<UTC suffix>.md" (Did you mean: ## Downtown Commercial Rates?).
   ```

---

## 7. Key Takeaways

* **Zero Vendor Lock-in**: All files are plain Markdown and standard JSON/SRT stored locally on your filesystem and Git.
* **Radical Provenance**: Every entity in your model is traceable back to the exact meeting or memo heading it derived from.
* **Continuous Integrity**: Automated snapshots and impact checking prevent silent documentation rot.
