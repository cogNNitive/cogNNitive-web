# Workflow Template Documentation

**Template:** workflow V_0-1-0
**Location:** `docs/templates/workflow/V_0-1-0/workflow_V_0-1-0_NN.md`

---

## Description

The **Workflow Template** is a level-2 iNNfo template for modeling declarative multi-skill processing workflows. It defines a sequence of stages, each executed by an agent skill, with typed artifacts flowing between stages.

Use this template when you need to:
- Chain multiple agent skills in a defined sequence
- Document a multi-step transformation workflow
- Create reusable processing workflows for content ingestion, model authoring, or script generation
- Coordinate skills like `nn-trannsform`, `nn-innfo`, and others in a single declarative file

## Concepts

| Concept | Type | Description |
|---------|------|-------------|
| **Workflow** | `text` | Root entity: name, version, description |
| **Stage** | `sequence` | Ordered processing steps. Document order = execution order |
| **SkillRef** | `list` | References to agent skills (maps to SKILL.md files) |
| **ArtifactType** | `list` | Artifact types: raw, markdown, format-model, script, any |
| **Transformation** | `list` | Rules mapping input artifacts to output artifacts per stage |

## Matrices

### Stage-Skill Matrix

Binds each Stage to the Skill that executes it. Each stage maps to exactly one skill.

| Stage \ SkillRef | skill-a | skill-b | skill-c |
| :--- | :---: | :---: | :---: |
| **Stage 1** | X | | |
| **Stage 2** | | X | |
| **Stage 3** | | | X |

The row header is the Stage element name. The column headers are SkillRef element names. Mark the matching cell with `X`.

### Stage-Artifact Matrix

Binds each Stage to the ArtifactType it produces.

| Stage \ ArtifactType | raw | markdown | format-model | script | any |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Stage 1** | X | | | | |
| **Stage 2** | | X | | | |
| **Stage 3** | | | | X | |

The row header is the Stage element name. The column headers are ArtifactType element names. Mark the matching cell with `X`.

## Unified `NN` Syntax

This template uses iNNfo's unified `NN` syntax (see `specs/iNNfo_V_0-1-0_NN.md`), not the
legacy `_F`/`_FORMAT` markers.

| Construct | Syntax | Example |
|---|---|---|
| Concept section | `# NN <Concept>` (H1) | `# NN Stage` |
| Element | `## NN <Concept>: <Element>` (H2) | `## NN Stage: Raw Ingestion` |
| Property | `key:: value` (line immediately after the element heading) | `skill:: [[nn-trannsform]]` |
| Matrix block | `# NN matrices: <matrix-name>` followed by a Markdown table | `# NN matrices: Stage-Skill matrix` |

Reference fields (`skill`, `from_type`, `to_type`) use WikiLink syntax `[[Target Element]]`.

## File Naming Convention

Workflow instance files follow:

```
<Name>_V_<major>-<minor>-<patch>_workflow_NN.md
```

Examples:
- `example_V_1-0-0_workflow_NN.md`
- `video-processing_V_2-0-0_workflow_NN.md`

## Frontmatter Reference

Every workflow instance must include this level-3 frontmatter. It references the
template by URL and MUST NOT inline the template's Concept/Field/Matrix
Definitions:

```yaml
---
spec_version: "V_0-1-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"
level: 3
parent_spec:
  name: "workflow_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/docs/skills/templates/workflow/V_0-1-0/workflow_V_0-1-0_NN.md"
model_version: "V_<major>-<minor>-<patch>"
title: "<Workflow Name>"
documentation_location: "docs/templates/workflow/V_0-1-0/"
---
```

## Guidelines

### Writing a Workflow Instance

1. Copy the frontmatter above and fill in your workflow name and version
2. Define the `Workflow` element with a description of what the workflow does
3. List `Stage` elements in execution order — each with `id`, `description`, `skill`, `template`, `input`, `output`
4. Declare `SkillRef` elements for each unique skill referenced by stages
5. List `ArtifactType` elements that the workflow produces
6. Fill the Stage-Skill matrix binding each stage to its skill
7. Fill the Stage-Artifact matrix showing what each stage produces

### Output Passthrough Convention

The `output` of Stage N becomes the `input` of Stage N+1. Explicit path values are used:

```
Stage 1: input="raw/" output="sources/"
Stage 2: input="sources/" output="models/"
Stage 3: input="models/" output="scripts/"
```

The orchestrator reads these values literally and passes them to the loaded skill.

## Sample

See [`samples/example_V_1-0-0_workflow_NN.md`](./samples/example_V_1-0-0_workflow_NN.md) for a complete three-stage workflow example (Raw Ingestion → FORMAT Model → Video Script).

## Template Location

```
docs/templates/workflow/
└── V_0-1-0/
    ├── workflow_V_0-1-0_NN.md          # This template
    ├── documentation.md                 # This documentation
    └── samples/
        └── example_V_1-0-0_workflow_NN.md
```
