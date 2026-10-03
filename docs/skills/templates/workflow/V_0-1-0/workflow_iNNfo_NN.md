---
spec_version: "V_0-1-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"
template_version: "V_0-1-0"
title: "Workflow Template"
documentation_location: "docs/templates/workflow/V_0-1-0/"
---

> [!NOTE]
> Workflow template for the cogNNitive ecosystem. Defines multi-skill processing
> workflows as declarative iNNfo documents using the unified `NN` syntax.
> **Version:** V_0-1-0 | **Template:** workflow

# NN index

* [[Workflow]]
* [[Stage]]
* [[SkillRef]]
* [[ArtifactType]]
* [[Transformation]]

# NN Concept Definition

## NN Concept Definition: Workflow
type:: text
Root entity identifying the workflow: name, version, and description. Every
workflow instance declares exactly one Workflow element.

## NN Concept Definition: Stage
type:: sequence
Ordered processing steps in the workflow. Document order defines execution
order: the first Stage element runs first, its output feeds the next Stage,
and so on.

## NN Concept Definition: SkillRef
type:: list
Agent skills available for stage execution. Each SkillRef element maps to a
`SKILL.md` file under `skills/`.

## NN Concept Definition: ArtifactType
type:: list
Classifies the data flowing through workflow stages. Each Stage produces one
artifact type, consumed by the next Stage.

## NN Concept Definition: Transformation
type:: list
Transformation rules mapping an input artifact type to an output artifact
type for a stage.

# NN Field Definition

## NN Field Definition: name
concept:: Workflow
type:: string
description:: Workflow name.

## NN Field Definition: description
concept:: Workflow
type:: string
description:: What the workflow does.

## NN Field Definition: version
concept:: Workflow
type:: string
description:: Workflow instance version (`V_x-y-z`).

## NN Field Definition: id
concept:: Stage
type:: string
description:: Unique identifier for the stage within the workflow.

## NN Field Definition: skill
concept:: Stage
type:: reference
target_concepts:: [SkillRef]
description:: The skill that executes this stage.

## NN Field Definition: template
concept:: Stage
type:: string
description:: Optional template name passed to the skill for this stage's execution.

## NN Field Definition: input
concept:: Stage
type:: string
description:: Source path or artifact consumed by this stage.

## NN Field Definition: output
concept:: Stage
type:: string
description:: Destination path or artifact produced by this stage.

## NN Field Definition: trigger
concept:: SkillRef
type:: string
description:: Trigger phrases that route to this skill.

## NN Field Definition: path
concept:: SkillRef
type:: string
description:: Path to the skill's `SKILL.md` file.

## NN Field Definition: type
concept:: ArtifactType
type:: select
options:: [raw, markdown, format-model, script, any]
description:: The artifact type this element names.

## NN Field Definition: from_type
concept:: Transformation
type:: reference
target_concepts:: [ArtifactType]
description:: The input artifact type this transformation consumes.

## NN Field Definition: to_type
concept:: Transformation
type:: reference
target_concepts:: [ArtifactType]
description:: The output artifact type this transformation produces.

## NN Field Definition: method
concept:: Transformation
type:: string
description:: How the transformation converts input to output.

# NN Matrix Definition

## NN Matrix Definition: Stage-Skill matrix
source:: Stage
target:: SkillRef
widget:: set
description:: Maps each stage to the skill that executes it. Each stage maps to exactly one skill.

## NN Matrix Definition: Stage-Artifact matrix
source:: Stage
target:: ArtifactType
widget:: set
description:: Maps each stage to the artifact type it produces as output. Each stage produces exactly one artifact type.

---

## File Naming Convention

- This template file: `workflow_iNNfo_NN.md` (level 2).
- Workflow instance files (level 3): `<Name>_V_<major>-<minor>-<patch>_workflow_NN.md`.

Examples:
- `example_workflow_NN.md`
- `video-processing_V_2-0-0_workflow_NN.md`

## Frontmatter Requirements

Every workflow instance MUST include level-3 frontmatter that references this
template by URL. Per defiNNe, a level-3 model MUST NOT inline the
`Concept Definition`/`Field Definition`/`Matrix Definition` schema above — it
relies on `parent_spec.url` and the spec resolver instead:

```yaml
---
spec_version: "V_0-1-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"
level: 3
parent_spec:
  name: "workflow_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/docs/skills/templates/workflow/V_0-1-0/workflow_iNNfo_NN.md"
model_version: "V_<major>-<minor>-<patch>"
title: "<Workflow Name>"
documentation_location: "docs/templates/workflow/V_0-1-0/"
---
```
