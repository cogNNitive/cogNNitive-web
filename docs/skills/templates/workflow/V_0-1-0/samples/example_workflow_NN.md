---
spec_version: "V_0-1-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"
level: 3
parent_spec:
  name: "workflow_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/docs/skills/templates/workflow/V_0-1-0/workflow_iNNfo_NN.md"
model_version: "V_1-0-0"
title: "Video a Comercial"
documentation_location: "docs/templates/workflow/V_0-1-0/"
---

> [!NOTE]
> Workflow que transforma un video raw en un comercial completo: normaliza el
> contenido fuente, genera un modelo de negocio iNNfo, y produce un script de
> Video.
> **Version:** V_1-0-0 | **Template:** workflow V_0-1-0

# NN index

* [[Workflow]]
* [[Stage]]
* [[SkillRef]]
* [[ArtifactType]]
* [[Transformation]]

# NN Workflow

## NN Workflow: Video a Comercial Workflow
name:: "Video a Comercial"
description:: "Transforma un video raw en un comercial completo mediante 3 stages: normalización, modelado iNNfo, y generación de script Video"
version:: "V_1-0-0"

# NN Stage

## NN Stage: Raw Ingestion
id:: "raw-ingestion"
description:: "Ingiere el video raw y lo normaliza a Markdown estructurado usando traNNsform en modo normalize-only"
skill:: [[traNNsform Normalization]]
template:: null
input:: "raw/"
output:: "sources/"

## NN Stage: FORMAT Model
id:: "format-model"
description:: "Procesa los sources normalizados y genera un modelo de negocio iNNfo usando el template business"
skill:: [[iNNfo Model Authoring]]
template:: "business"
input:: "sources/"
output:: "models/"

## NN Stage: Video Script
id:: "video-script"
description:: "Toma el modelo iNNfo y genera un script de Video para el comercial final"
skill:: [[traNNsform Normalization]]
template:: "video"
input:: "models/"
output:: "scripts/"

# NN SkillRef

## NN SkillRef: traNNsform Normalization
name:: "nn-sources"
trigger:: "trannsform, transform, normalize, scan documents"
path:: "skills/nn-sources/SKILL.md"

## NN SkillRef: iNNfo Model Authoring
name:: "nn-innfo"
trigger:: "innfo, model, iNNfo"
path:: "skills/nn-innfo/SKILL.md"

# NN ArtifactType

## NN ArtifactType: Raw Video
type:: raw
description:: "Video fuente sin procesar (MP4, MOV, etc.)"

## NN ArtifactType: Normalized Markdown
type:: markdown
description:: "Contenido normalizado a Markdown estructurado"

## NN ArtifactType: iNNfo Business Model
type:: format-model
description:: "Modelo de negocio iNNfo con template business"

## NN ArtifactType: Video Script
type:: script
description:: "Script de Video listo para producción del comercial"

# NN Transformation

## NN Transformation: Raw to Markdown
from_type:: [[Raw Video]]
to_type:: [[Normalized Markdown]]
method:: "normalize-only — ingesta y normalización sin aplicación de template"

## NN Transformation: Markdown to iNNfo Model
from_type:: [[Normalized Markdown]]
to_type:: [[iNNfo Business Model]]
method:: "autoría de modelo iNNfo con template business a partir de sources normalizados"

## NN Transformation: iNNfo Model to Video Script
from_type:: [[iNNfo Business Model]]
to_type:: [[Video Script]]
method:: "aplicación de template video sobre el modelo iNNfo para generar script de comercial"

# NN matrices: Stage-Skill matrix

| Stage \ SkillRef | traNNsform Normalization | iNNfo Model Authoring |
| :--- | :---: | :---: |
| Raw Ingestion | X | |
| FORMAT Model | | X |
| Video Script | X | |

# NN matrices: Stage-Artifact matrix

| Stage \ ArtifactType | Raw Video | Normalized Markdown | iNNfo Business Model | Video Script |
| :--- | :---: | :---: | :---: | :---: |
| Raw Ingestion | X | | | |
| FORMAT Model | | | X | |
| Video Script | | | | X |

---

## Workflow Data Flow

```
raw/  ──[Raw Ingestion]──▶  sources/  ──[FORMAT Model]──▶  models/  ──[Video Script]──▶  scripts/
 │  tipo: raw                │  tipo: markdown             │  tipo: format-model        │  tipo: script
 │  skill: nn-sources     │  skill: nn-innfo            │  skill: nn-sources      │
 │  modo: normalize-only     │  template: business         │  template: video          │
```

## Directory Layout

```
project/
├── raw/                        ← Colocar acá los videos fuente
│   └── video-fuente.mp4
├── sources/                    ← Generado por Stage 1
│   └── video-fuente.md
├── models/                     ← Generado por Stage 2
│   └── VideoComercial_V_1-0-0_business_NN.md
├── scripts/                    ← Generado por Stage 3
│   └── comercial_video.any
└── example_workflow_NN.md
```
