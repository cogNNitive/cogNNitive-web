# Simulacro — user-flow simulation report

Generated: 2026-09-30T11:16:28.044Z

**51 passed · 0 failed · 7 observed**

| Scenario | Pass | Fail | Observed |
| --- | ---: | ---: | ---: |
| S01 — Source ingestion & citation traceability | 10 | 0 | 1 |
| S02 — Modifying a model | 12 | 0 | 1 |
| S03 — Save/load fidelity of shipped models | 5 | 0 | 1 |
| S04 — Template-authoring gate (level 2 vs level 3) | 5 | 0 | 1 |
| S05 — Tabular source ingestion & row-level citations | 6 | 0 | 0 |
| S06 — Workspace manifest reconciliation | 5 | 0 | 2 |
| S07 — Opening the shipped sample workspace | 6 | 0 | 0 |
| S08 — Consuming innfo-core from plain Node | 2 | 0 | 1 |

## S01 — Source ingestion & citation traceability

_An analyst imports a primary source, cites its sections from model elements, and relies on the workspace to prove every citation resolves._

### ✅ Workspace parses from the canonical entrypoint
- **Expected:** domaiNN_NN.md resolves as entrypoint, models load, no parse issues
- **Actual:**

```
{
  "entrypointPath": "domaiNN_NN.md",
  "nodes": 8,
  "issues": 0
}
```

### ✅ All citations in a well-formed workspace resolve cleanly
- **Expected:** zero diagnostics — every `@` pointer resolves to a real file, heading and CSV row
- **Actual:**

```
[]
```

### ✅ A heading citation parses into an addressable knowledge unit
- **Expected:** parses to a header unit at level 2 under sources/nn/
- **Actual:**

```
{
  "filePath": "sources/nn/market-report-2026.md",
  "fileName": "market-report-2026.md",
  "slug": "q4-outlook",
  "kind": "source",
  "unit": {
    "kind": "header",
    "level": 2,
    "text": "Q4 Outlook",
    "slug": "q4-outlook"
  },
  "subunits": [],
  "raw": "market-report-2026.md@## Q4 Outlook"
}
```

### ✅ Citation is structurally stable across a write-back cycle
- **Expected:** the pointer still resolves to the same heading after the agent writes it back
- **Actual:**

```
{
  "authored": "market-report-2026.md@## Q4 Outlook",
  "written": "sources/nn/market-report-2026.md@## Q4 Outlook",
  "rereadSlug": "q4-outlook"
}
```

### ✅ Citation keeps its human-readable heading text across a write-back cycle
- **Expected:** a human wrote `@## Q4 Outlook`; after one save it should still read as `## Q4 Outlook`
- **Actual:**

```
{
  "authoredText": "Q4 Outlook",
  "writtenForm": "sources/nn/market-report-2026.md@## Q4 Outlook",
  "rereadText": "Q4 Outlook"
}
```

### ✅ Cited section resolves to a concrete line range in the source
- **Expected:** the pointer maps to real text the user can read back, not just a string
- **Actual:**

```
{
  "heading": {
    "level": 2,
    "text": "Q4 Outlook",
    "slug": "q4-outlook",
    "line": 4
  },
  "startLine": 4,
  "endLine": 9
}
```

### ℹ️ Element carrying the citation
- **Actual:**

```
{
  "name": "Demand Grows In Q4",
  "fields": {
    "sources": {
      "value": [
        "market-report-2026.md@## Q4 Outlook"
      ],
      "editAttribution": {
        "author": {
          "kind": "system",
          "id": "parser"
        },
        "timestamp": "2026-09-30T11:16:27.774Z"
      }
    }
  }
}
```

### ✅ Deleting the source file outside the app is reported, not silently ignored
- **Expected:** KU_DANGLING_FILE error naming the missing file
- **Actual:**

```
[
  {
    "code": "KU_DANGLING_FILE",
    "severity": "error",
    "message": "Dangling source reference: \"sources/nn/market-report-2026.md\" is not present in this workspace"
  },
  {
    "code": "KU_DANGLING_FILE",
    "severity": "error",
    "message": "Dangling source reference: \"sources/nn/market-report-2026.md\" is not present in this workspace"
  },
  {
    "code": "KU_DANGLING_FILE",
    "severity": "error",
    "message": "Dangling source reference: \"sources/nn/market-report-2026.md\" is not present in this workspace"
  }
]
```

### ✅ Renaming a cited heading in the source surfaces a drift warning
- **Expected:** KU_UNKNOWN_SLUG — the file still exists but the cited unit moved
- **Actual:**

```
[
  {
    "code": "KU_UNKNOWN_SLUG",
    "severity": "warning",
    "message": "Source reference \"market-report-2026.md@## Q4 Outlook\" points at heading \"@q4-outlook\" which does not exist in \"market-report-2026.md\""
  }
]
```

### ✅ Raw material under sources/original/ is refused as a citation target
- **Expected:** null — only normalized sources under sources/nn/ carry provenance
- **Actual:**

```
null
```

### ✅ A query string cannot stand in for a resolved citation
- **Expected:** QU_NOT_PROVENANCE error — queries must be resolved to pointers before being cited
- **Actual:**

```
[
  {
    "code": "QU_NOT_PROVENANCE",
    "severity": "error"
  }
]
```

## S02 — Modifying a model

_A user adds a risk, edits it, renames an assumption other elements reference, and deletes a stale entry — expecting the file to stay coherent._

### ✅ Model loads with its elements addressable by concept
- **Expected:** concepts and elements are indexed the way the editor tree shows them
- **Actual:**

```
{
  "concepts": [
    "Assumptions",
    "Risks",
    "Keys"
  ],
  "assumptions": [
    "Demand Grows In Q4",
    "Unit Cost Falls"
  ]
}
```

### ✅ Adding an element succeeds and lands under the right concept
- **Expected:** the new risk is present, no error
- **Actual:**

```
{
  "success": true,
  "risks": [
    "Supplier Concentration",
    "Warehouse Overtime Cost"
  ]
}
```

### ✅ A duplicate element name anywhere in the model is refused
- **Expected:** model-wide element name uniqueness (R-IE-02) is enforced
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "",
      "message": "Element \"Warehouse Overtime Cost\" already exists in this model — element names must be unique model-wide"
    }
  ]
}
```

### ✅ Updating a field on an existing element succeeds
- **Expected:** no error; the field is written
- **Actual:**

```
{
  "success": true
}
```

### ✅ Editing a non-existent element fails loudly instead of silently creating one
- **Expected:** a clear error, and no phantom element
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "",
      "message": "Element \"Does Not Exist\" not found in concept \"Risks\""
    }
  ]
}
```

### ✅ Renaming an element also repoints the matrices that name it
- **Expected:** the matrix row label follows the rename — no dangling label
- **Actual:**

```
{
  "success": true,
  "beforeRows": [
    "Demand Grows In Q4",
    "Unit Cost Falls"
  ],
  "afterRows": [
    "Q4 Demand Growth",
    "Unit Cost Falls"
  ]
}
```

### ✅ The renamed element keeps its citations
- **Expected:** renaming must not drop the provenance attached to the element
- **Actual:**

```
{
  "sources": [
    "market-report-2026.md@## Q4 Outlook"
  ]
}
```

### ✅ A misspelled concept name is refused rather than silently creating a new concept
- **Expected:** the template declares the legal concepts; `Rsiks` is not one of them
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "conceptName",
      "message": "Concept \"Rsiks\" is not declared in the template. Did you mean \"Risks\"?"
    }
  ],
  "concepts": [
    "Assumptions",
    "Risks",
    "Keys"
  ]
}
```

### ✅ Serialized model re-parses with the same element inventory
- **Expected:** a save/load cycle loses nothing
- **Actual:**

```
{
  "before": {
    "Assumptions": 2,
    "Risks": 2,
    "Keys": 1
  },
  "after": {
    "Assumptions": 2,
    "Risks": 2,
    "Keys": 1
  }
}
```

### ✅ Citations survive the save/load cycle in the spec-correct bracket form
- **Expected:** sources:: lines are written unquoted as `[a, b]`, matching what the reader expects
- **Actual:**

```
[
  "sources:: [market-report-2026.md@## Q4 Outlook]",
  "sources:: [market-report-2026.md@## Cost Curve, unit-costs.csv@SKU-014]",
  "sources:: [market-report-2026.md@## Supplier Landscape]"
]
```

### ✅ Removing an element succeeds and it disappears from the model
- **Expected:** the element is gone
- **Actual:**

```
{
  "success": true,
  "risks": [
    "Supplier Concentration"
  ]
}
```

### ✅ An unknown operation is rejected and leaves the model untouched
- **Expected:** failed mutations are atomic — the document is byte-identical afterwards
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "",
      "message": "Unknown operation: not_a_real_op"
    }
  ],
  "unchanged": true
}
```

### ℹ️ Fixture file on disk was never written
- **Actual:**

```
the simulation mutates in memory only; fixtures/acme stays pristine
```

## S03 — Save/load fidelity of shipped models

_A user opens a shipped sample, changes nothing meaningful, saves — and expects a clean git diff._

### ✅ A no-op save leaves every shipped model byte-identical
- **Expected:** parse -> serialize is the identity on canonical, spec-conformant files
- **Actual:**

```
[
  {
    "file": "Ghostbusters_analysis_NN.md",
    "identical": true,
    "lines": "88->88"
  },
  {
    "file": "Ghostbusters_business-model_NN.md",
    "identical": true,
    "lines": "103->103"
  },
  {
    "file": "Ghostbusters_business_NN.md",
    "identical": true,
    "lines": "946->946"
  },
  {
    "file": "Ghostbusters_design-presets_NN.md",
    "identical": true,
    "lines": "54->54"
  },
  {
    "file": "Ghostbusters_documentation_NN.md",
    "identical": true,
    "lines": "150->150"
  },
  {
    "file": "Ghostbusters_innovation_NN.md",
    "identical": true,
    "lines": "199->199"
  },
  {
    "file": "Ghostbusters_metrics_NN.md",
    "identical": true,
    "lines": "201->201"
  },
  {
    "file": "Ghostbusters_organization_NN.md",
    "identical": true,
    "lines": "197->197"
  },
  {
    "file": "Ghostbusters_procedures_NN.md",
    "identical": true,
    "lines": "234->234"
  },
  {
    "file": "Ghostbusters_projects_NN.md",
    "identical": true,
    "lines": "186->186"
  },
  {
    "file": "Ghostbusters_repository_NN.md",
    "identical": true,
    "lines": "59->59"
  },
  {
    "file": "Ghostbusters_video_NN.md",
    "identical": true,
    "lines": "26->26"
…
```

### ✅ Matrix axis labels survive a save
- **Expected:** a header reading `| Metrics  Variables |` must not become `| Row  Col |`
- **Actual:**

```
[]
```

### ✅ Document section order survives a save
- **Expected:** the author chose the order of `# NN` sections; a save must not reshuffle it
- **Actual:**

```
[]
```

### ✅ Bracketed list values survive a save
- **Expected:** `tags:: [a, b]` must not silently become `tags:: a, b`
- **Actual:**

```
[]
```

### ℹ️ Second-pass stability (is the canonical form at least a fixed point?)
- **Actual:**

```
[
  "Ghostbusters_analysis_NN.md",
  "Ghostbusters_business-model_NN.md",
  "Ghostbusters_business_NN.md",
  "Ghostbusters_design-presets_NN.md",
  "Ghostbusters_documentation_NN.md"
]
```

### ✅ The canonical form is at least stable after the first save
- **Expected:** once degraded, further saves produce no further drift (bounded damage)
- **Actual:**

```
[]
```

## S04 — Template-authoring gate (level 2 vs level 3)

_An agent tries to extend the schema from inside a user model; the gate must hold._

### ✅ Level-3 model refuses `add_concept`
- **Expected:** schema-authoring ops are gated to level-2 documents
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "frontmatter.level",
      "message": "Operation \"add_concept\" authors template primitives and is only valid on a level-2 template; this document is level 3. Use add_element/update_field on a level-3 model, or target the parent template."
    }
  ]
}
```

### ✅ Level-3 model refuses `add_field`
- **Expected:** schema-authoring ops are gated to level-2 documents
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "frontmatter.level",
      "message": "Operation \"add_field\" authors template primitives and is only valid on a level-2 template; this document is level 3. Use add_element/update_field on a level-3 model, or target the parent template."
    }
  ]
}
```

### ✅ Level-3 model refuses `set_marker`
- **Expected:** schema-authoring ops are gated to level-2 documents
- **Actual:**

```
{
  "success": false,
  "errors": [
    {
      "path": "frontmatter.level",
      "message": "Operation \"set_marker\" authors template primitives and is only valid on a level-2 template; this document is level 3. Use add_element/update_field on a level-3 model, or target the parent template."
    }
  ]
}
```

### ✅ The same op succeeds on a level-2 template
- **Expected:** the gate discriminates by level, it does not simply forbid the op
- **Actual:**

```
{
  "success": true
}
```

### ✅ A level-3 model declaring inline schema is rejected by validation
- **Expected:** an error naming the illegal frontmatter key
- **Actual:**

```
[
  {
    "path": "format.fm-no-inline-schema",
    "message": "Inline schema fields (matrices, concepts, markers, relationship_types) found in frontmatter. Move them to the template."
  }
]
```

### ℹ️ What a level-3 model looks like after a refused mutation
- **Expected:** no `# NN Concept Definition` section should have appeared
- **Actual:**

```
# NN Analysis | # NN Assumptions | # NN Risks | # NN Keys | # NN matrices: assumptions-risks matrix
```

## S05 — Tabular source ingestion & row-level citations

_An analyst imports a cost table and cites one SKU row from a model assumption._

### ✅ The imported table parses with a usable key column
- **Expected:** columns and three data rows
- **Actual:**

```
{
  "columns": [
    "sku",
    "component",
    "unit_cost",
    "supplier"
  ],
  "rowCount": 3
}
```

### ✅ A row citation parses as a row unit, not a heading
- **Expected:** the `.csv` extension selects the row grammar automatically
- **Actual:**

```
{
  "filePath": "sources/nn/unit-costs.csv",
  "fileName": "unit-costs.csv",
  "kind": "source",
  "unit": {
    "kind": "row",
    "id": "SKU-014"
  },
  "subunits": [],
  "raw": "unit-costs.csv@SKU-014"
}
```

### ✅ A valid row citation produces no diagnostics
- **Expected:** SKU-014 exists in the table, so nothing to report
- **Actual:**

```
[]
```

### ✅ Deleting the cited row upstream is reported
- **Expected:** KU_UNKNOWN_ROW error — the citation no longer resolves
- **Actual:**

```
[
  {
    "code": "KU_UNKNOWN_ROW",
    "severity": "error"
  }
]
```

### ✅ Duplicate keys in the source table are reported once, not per citation
- **Expected:** exactly one KU_DUPLICATE_KEY for the file
- **Actual:**

```
[
  "KU_DUPLICATE_KEY"
]
```

### ✅ A line-range citation is refused (line numbers are not stable provenance)
- **Expected:** null — provenance addresses named units, never line offsets
- **Actual:**

```
null
```

## S06 — Workspace manifest reconciliation

_A user adds a model file by hand and expects the workspace index to notice — without losing their own edits._

### ✅ Reconciling an already-correct manifest changes nothing
- **Expected:** no changes and a byte-identical document (the documented round-trip guarantee)
- **Actual:**

```
{
  "changes": [],
  "identical": true
}
```

### ✅ A newly added model file is registered in the manifest
- **Expected:** one `added` change and a new `## NN Models:` entry
- **Actual:**

```
{
  "changes": [
    {
      "kind": "added",
      "path": "kNNowledge/Acme_metrics_NN.md",
      "name": "Acme Operational Metrics"
    }
  ],
  "containsNew": true
}
```

### ✅ Tool-written entries are explicitly marked as tool-owned
- **Expected:** the ownership marker <!-- nn:auto --> appears on the generated entry
- **Actual:**

```
[
  "<!-- nn:auto -->"
]
```

### ✅ A human-owned entry whose file is gone is reported, never silently deleted
- **Expected:** the tool reports it rather than editing something it does not own
- **Actual:**

```
[
  {
    "kind": "skipped-not-owned",
    "path": "kNNowledge/Acme_analysis_NN.md",
    "name": "Acme Operational Analysis",
    "reason": "file missing, entry not tool-owned"
  }
]
```

### ℹ️ validateWorkspaceReferences requires a WorkspaceIndex the type surface does not make obvious
- **Actual:**

```
calling it with the index omitted throws a raw TypeError on `index.nodeSchema` rather than a named error
```

### ✅ Workspace-wide reference validation runs clean on a coherent workspace
- **Expected:** no dangling cross-model references
- **Actual:**

```
[]
```

### ℹ️ Models the workspace scan discovered
- **Actual:**

```
[]
```

## S07 — Opening the shipped sample workspace

_A new user opens the workspace we ship. Everything they see on day one is what this scenario measures._

### ✅ The shipped workspace parses without issues
- **Expected:** all sample models load with no error or warning issues — this is the first thing a new user sees
- **Actual:**

```
{
  "entrypoint": "domaiNN_NN.md",
  "models": 18,
  "actionableIssueCount": 0,
  "infoNotes": 28,
  "issueKinds": {}
}
```

### ✅ Every shipped sample passes document hygiene with no errors
- **Expected:** zero hygiene errors across the eleven samples
- **Actual:**

```
[]
```

### ✅ Every citation in the shipped workspace resolves
- **Expected:** a new user opening the sample sees no broken provenance
- **Actual:**

```
[
  {
    "code": "KU_DEPRECATED_HASH",
    "severity": "warning",
    "path": "artifacts_NN.md#Workspace Hub Interactive Dashboard.sources"
  },
  {
    "code": "KU_DEPRECATED_HASH",
    "severity": "warning",
    "path": "artifacts_NN.md#Executive Remediation Report 1984.sources"
  }
]
```

### ✅ The shipped workspace contains the sources its models cite
- **Expected:** source traceability is the headline capability — the demo must demonstrate it
- **Actual:**

```
{
  "sourcesDir": "sources/nn/",
  "files": [
    "containment-incidents-1984.csv",
    "nyc-paranormal-activity-report-1984.md"
  ]
}
```

### ✅ Every artifact the shipped workspace declares actually exists
- **Expected:** the workspace must not advertise an artifact it does not ship
- **Actual:**

```
{
  "declared": [],
  "missing": []
}
```

### ✅ A field named `source` that is declared as a content path is not treated as a citation
- **Expected:** the Citation vocabulary should key on the declared field TYPE, not on the field NAME
- **Actual:**

```
{
  "template": "documentation",
  "declaredType": "markdown_file",
  "citationFieldNames": [
    "sources",
    "source"
  ],
  "diagnosticsOnDocumentationSample": []
}
```

## S08 — Consuming innfo-core from plain Node

_An integrator runs `npm i @cognnitive/innfo-core` and writes `import { parseKnowledge } from ...` in a Node script._

### ✅ The published package imports under plain Node ESM
- **Expected:** package.json declares "type":"module" and "main":"./dist/index.js" — Node must be able to load it
- **Actual:**

```
{
  "ok": true,
  "error": null
}
```

### ✅ Once bundled, the public API surface is complete and usable
- **Expected:** the API itself is fine — only the module format blocks plain-Node consumption
- **Actual:**

```
{
  "exportCount": 126,
  "sample": [
    "parseKnowledge",
    "serializeKnowledge",
    "applyMutation",
    "validateDocument"
  ]
}
```

### ℹ️ Why every existing consumer hides this
- **Actual:**

```
innfo-editor resolves through Vite, the test suites through Vitest, innfo-mcp through tsup — all bundlers, all of which tolerate extensionless directory imports that Node rejects.
```
