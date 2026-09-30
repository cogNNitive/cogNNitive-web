# Relaciones y Conexiones en iNNfo

El modelo de datos de **iNNfo** no se limita a almacenar bloques jerárquicos o páginas independientes: constituye una **Red de Conocimiento (Knowledge Graph)** donde las entidades interactúan entre sí.

En iNNfo, las relaciones entre elementos y conceptos se clasifican en **5 niveles formales** (alineados con la Especificación Nivel 1 `iNNfo_V_0-2-1_NN.md`), dependiendo de su origen y grado de estructuración.

---

## Los 5 Niveles de Relaciones

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │                  RED DE CONOCIMIENTO                    │
                                  └────────────────────────────┬────────────────────────────┘
                                                               │
         ┌───────────────────────────────┬─────────────────────┼─────────────────────────────┬───────────────────────────────┐
         ▼                               ▼                     ▼                             ▼                               ▼
┌───────────────────┐         ┌───────────────────┐ ┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
│ 1. JERÁRQUICA     │         │ 2. ESTRUCTURAL    │ │ 3. ATRIBUTO       │         │ 4. CONTEXTUAL     │         │ 5. SUBMODELO      │
│    (Taxonomía)    │         │    (Matriz)       │ │    (Campo)        │         │    (Mención)      │         │    (type:: model) │
└────────┬──────────┘         └────────┬──────────┘ └────────┬──────────┘         └────────┬──────────┘         └────────┬──────────┘
         │                             │                     │                             │                             │
  Anidamiento de árbol        Matriz de Dominio       Campo referencial             Wikilink libre                Composición modular
  (# NN index)                (ej. WORK → ROLES)      (key:: [[target]])            ([[Target Element]])          (campo:: [[sub_NN.md]])
```

### 1. Relaciones Jerárquicas / Taxonómicas (`hierarchy`)

- **Origen**: Bloque `# NN index` al inicio del modelo Nivel 3.
- **Sintaxis**: Listas Markdown anidadas usando sintaxis WikiLink (`* [[Padre]]` → `  * [[Hijo]]`).
- **Icono Visual**: 🌳 `FolderTree` / Árbol lateral
- **Ejemplo**: `Salón-Comedor` anidado dentro de `Casa`.

### 2. Relaciones Estructurales (`evaluable_matrix`)

- **Origen**: Celdas de intersección declaradas en matrices formales del metamodelo (ej. `WORK → ROLES` o `WORK → ARTIFACT`).
- **Sintaxis**: Declaración centralizada en cabecera de metamodelo (`matrices`) o bloques `# NN matrices:` e intersecciones en bloques.
- **Icono Visual**: 📊 `LayoutGrid`
- **Ejemplo**: Un procedimiento `Solicitud de Visado` asignado con el rol `Responsible` hacia `Inés (viajera)`.

### 3. Relaciones por Atributo (Campos Referenciales)

- **Origen**: Campos estructurados en los bloques cuyos valores hacen referencia explícita a otro elemento mediante corchetes WikiLink.
- **Sintaxis**: `campo:: [[nombre_del_elemento]]` (campos con `type:: reference` en su definición).
- **Icono Visual**: 🏷️ `Tag`
- **Ejemplo**: `location:: [[Salón-Comedor]]` o `depends_on:: [[Verificación de Pasaporte]]`.
- **Nota importante**: Los campos referenciales NUNCA deben escribirse como texto plano (`location:: Salón-Comedor`); el uso de `[[...]]` es obligatorio para que el motor de iNNfo resuelva la conexión en la red.

### 4. Relaciones Contextuales (Menciones & Wikilinks)

- **Origen**: Menciones informales y enlaces de hipertexto escritos libremente en el cuerpo Markdown de la descripción de un bloque.
- **Sintaxis**: `[[Nombre del Elemento]]` dentro del texto explicativo.
- **Icono Visual**: 📝 `FileText`
- **Ejemplo**: _"...para completar este paso es necesario revisar el [[Formulario DS-2019]] emitido por el patrocinador."_

### 5. Composición de Submodelos (`type:: model`)

La composición de submodelos permite desacoplar arquitecturas complejas subdividiendo el dominio en múltiples documentos físicos Nivel 3 (`*_NN.md`), manteniendo una relación formal de pertenencia y navegación entre un elemento padre y un modelo hijo especializado.

- **Origen**: Definición formal en el metamodelo con `type:: model` y restricción opcional `target_template:: <template>`.
- **Sintaxis de Campo**: `campo:: [[ruta/al/submodelo_NN.md]]` o `campo:: ruta/al/submodelo_NN.md`.
- **Icono Visual**: 📦 `Boxes` / Píldora interactiva de submodelo con badge de plantilla.
- **Comportamiento en Árbol**: El submodelo no flota como raíz independiente en el espacio de trabajo; se anida bajo el elemento que lo declara y se excluye de las raíces globales.

#### Ejemplo Canónico: Ghostbusters Innovation → Business Model

Un modelo de cartera de innovación (`Ghostbusters_V_0-2-0_innovation_NN.md`) contiene la iniciativa de expansión municipal, la cual instancia su propio modelo de negocio dedicado (`Ghostbusters_V_0-2-0_business_NN.md`):

##### 1. Definición en Metamodelo (`innovation_V_0-2-0_NN.md`)

```markdown
## NN Field Definition: business_model

concept:: Initiative
type:: model
target_template:: business
```

##### 2. Instanciación en el Modelo Padre (`Ghostbusters_V_0-2-0_innovation_NN.md`)

```markdown
# NN Initiative

## NN Initiative: Ghostbusters Municipal Franchise Expansion

initiativeName:: "Ghostbusters Municipal Franchise Expansion"
initiativeType:: "Commercial Service Expansion"
business_model:: [[models/Ghostbusters_V_0-2-0_business_NN.md]]
tags:: [initiative, franchise, commercial, expansion]
```

##### 3. Submodelo Hijo Scaffolded (`Ghostbusters_V_0-2-0_business_NN.md`)

```markdown
---
level: 3
parent_spec:
  name: "business"
model_version: "0.1.0"
title: "Ghostbusters Inc. Municipal Franchise Business Model"
---

# NN Business Model
```

#### Experiencia Visual e Interactiva

1. **Creación en un Clic**: Desde el editor del campo en `FieldModel.vue`, el botón `[+ Create & bind new model]` crea automáticamente el documento hijo con cabeceras estándar Nivel 3 y la plantilla esperada.
2. **Jerarquía Limpia en la Barra Lateral**: En la vista de espacio de trabajo, el submodelo se excluye de las raíces no adjuntas y se muestra anidado directamente bajo el elemento que lo declara (`ConceptTreeNode.vue`), acompañado del icono 📦 `Boxes` y la etiqueta de la plantilla.
3. **Navegación Fluida**: Al hacer clic en el submodelo hijo (en la píldora del campo o en el árbol lateral), `uiStore.focusModel` activa el modo enfocado y despliega la ruta de migas de pan (`Workspace > Ghostbusters Innovation > Ghostbusters Business`).

---

## Direccionalidad de las Conexiones

Todas las relaciones en el editor se presentan con un indicador claro de dirección según la posición del elemento actual:

### Conexión Saliente (`outgoing`)

Indica que el elemento actual **inicia o apunta** la relación hacia un elemento destino:
$$\text{> ( Rol / Campo ) > [Píldora Destino]}$$

- **Ejemplo**: `> ( 🏷️ location ) > [Salón-Comedor]`

### Conexión Entrante (`incoming`)

Indica que otro elemento fuente **apunta o referencia** al elemento actual (Backlinks / Participación como destino):
$$\text{[Píldora Fuente] < ( Rol / Campo ) <}$$

- **Ejemplo**: `[Sofás salón] < ( 🏷️ location ) <`

### Conexión Completa (`full`)

En vistas globales, reportes de validación o tablas completas:
$$\text{[Píldora Fuente] — ( Rol / Campo ) → [Píldora Destino]}$$

---

## Componente `ConnectionPill`

La interfaz visual de iNNfo estandariza todas estas relaciones mediante el componente **`ConnectionPill`**, el cual reúne:

1. El **icono del tipo de relación** (📊 Matriz, 🏷️ Campo, 📝 Mención).
2. El **rol o nombre de la relación** en un badge destacado.
3. El **bloque interactivo (`BlockPill`)** del nodo conectado con su icono de concepto, color y soporte de navegación al hacer click.
