---
spec_version: "V_0-2-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/main/specs/v0.2.0/level2/procedures/procedures_V_0-2-0_NN.md"
knowledge_version: "V_1-0-0"
level: 3
parent:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/main/specs/v0.2.0/level2/procedures/procedures_V_0-2-0_NN.md"
mode: "FILE"
template:
  name: "procedures"
  version: "V_0-2-0"
  title: "Comprehensive Test Procedure"
  last_updated: "2026-06-24T00:00:00.000Z"
  concepts:
    - name: "procedure"
      icon: "file-text"
      type: "text"
      mode: "basic"
      color: "purple"
      weight: 100
      ai_applicability: 9
    - name: "work"
      icon: "list-ordered"
      type: "sequence"
      mode: "basic"
      color: "purple"
      weight: 90
      ai_applicability: 9
      fields:
        - name: "step_type"
          type: "select"
          options:
            - "task"
            - "decision"
            - "event"
        - name: "next"
          type: "string"
        - name: "condition"
          type: "string"
        - name: "input"
          type: "reference"
          target_concepts:
            - "artifact"
        - name: "output"
          type: "reference"
          target_concepts:
            - "artifact"
        - name: "output_status"
          type: "string"
        - name: "tool"
          type: "reference"
          target_concepts:
            - "tools"
    - name: "artifact"
      icon: "package"
      type: "list"
      mode: "basic"
      color: "blue"
      weight: 80
      ai_applicability: 7
    - name: "tools"
      icon: "wrench"
      type: "list"
      mode: "basic"
      color: "orange"
      weight: 70
      ai_applicability: 8
    - name: "roles"
      icon: "users"
      type: "list"
      mode: "basic"
      color: "green"
      weight: 60
      ai_applicability: 8
      fields:
        - name: "scope"
          type: "select"
          options:
            - "internal"
            - "external"
  markers:
    - name: "complexity"
      icon: "gauge"
      description: "How complex is the procedure to execute"
      mode: "basic"
      color: "green"
      weight: 50
  matrices:
    - name: "work-roles matrix"
      source: "work"
      target: "roles"
      params: "Responsible;Accountable;Consulted;Informed"
    - name: "work-tools matrix"
      source: "work"
      target: "tools"
      params: "Uses"
    - name: "work-artifacts matrix"
      source: "work"
      target: "artifact"
      params: "Creates;Modifies;Validates;Reviews"
    - name: "item-markers matrix"
      source: "elements"
      target: "markers"
title: "Comprehensive Test Procedure"
last_saved: "2026-06-24T12:00:00.000Z"
---
> [!NOTE]
> This is a **FORMAT document** — a plain-text Markdown file that carries its own schema in the YAML frontmatter. New to FORMAT? The [onboarding guide](https://format.innv0.com/docs/onboarding) walks you through what this is and how to open it in the visual editor.

# <!-- block: concepts --> index
* [[roles]]
* [[work]]
* [[artifact]]
* [[tools]]

# <!-- block: concepts --> procedure
This procedure is a comprehensive functional test suite for the FORMAT application. Each element is intentionally named to describe the specific functionality it exercises. The goal is to validate rendering, editing, referencing, sequencing, and matrix interactions across all template concepts. Run through each section to confirm the application handles every combination of fields, references, and relationships correctly.

# <!-- block: concepts --> roles
* <!-- block: roles --> Role with No Fields
A role that has zero fields configured. Tests that the application renders a role with only its name and description, with no field widgets.
* <!-- block: roles --> Role with Scope Internal
scope:: internal
A role restricted to internal scope. Tests that the scope select field renders and filters correctly.
* <!-- block: roles --> Role with Scope External
scope:: external
A role restricted to external scope. Tests the alternate value of the scope select field and cross-scope differentiation.
* <!-- block: roles --> Role with Relations
scope:: internal
A role that appears in every RACI matrix row across multiple steps. Tests that role-step relationships render and update correctly in the work-roles matrix.
* <!-- block: roles --> Role as Orphan
A role that is defined but never referenced in any step or position matrix. Tests that the application handles unreferenced roles gracefully without rendering errors.

# <!-- block: concepts --> steps
1. <!-- block: work --> Basic Step
step_type:: task
next:: Step with All References
 A task step with only step_type and next — no input, output, condition, or output_status. Tests that the minimal required fields render correctly and that the next-pointer links to the following step.
2. <!-- block: work --> Step with All References
step_type:: task
next:: Decision Step with Branching
condition:: artifact must exist
input:: Basic Artifact
output:: Artifact with Fields
output_status:: draft
tool:: Test Runner
 A task step that populates every available field: step_type, next, condition, input, output, output_status, and tool. Tests that all seven field types render and that reference fields correctly resolve to artifact and tool names.
3. <!-- block: work --> Decision Step with Branching
step_type:: decision
condition:: approval granted
 A decision step that branches. When the condition is met, flow continues to the next step; otherwise it loops back. Tests that decision-type steps render with branching indicators and that condition logic is visible.
4. <!-- block: work --> Step Outputting Final Artifact
step_type:: task
output:: Artifact with Fields
output_status:: final
 A task step that produces a final-status artifact. Tests that output_status accepts non-draft values and that the artifact reference resolves.
5. <!-- block: work --> Event Step External Trigger
step_type:: event
condition:: external system callback received
 An event-type step triggered by an external condition. Tests that event steps render differently from task steps and that condition text is displayed.
6. <!-- block: work --> Step with Multiple Inputs
step_type:: task
input:: Basic Artifact
next:: Step with All References
tool:: Mockup Editor
 A task step that consumes an artifact and uses a design tool. Tests that the input and tool references resolve and that the step connects to the next step via the next pointer.
7. <!-- block: work --> Step with No Next (Terminal)
step_type:: task
output:: Artifact with Fields
output_status:: approved
 A terminal task step with no next pointer. Tests that the application correctly renders a step that ends the sequence.
8. <!-- block: work --> Step Referencing Nonexistent Artifact
step_type:: task
input:: Ghost Artifact
next:: Basic Step
 A task step whose input references an artifact that does not exist in the model. Tests that the application surfaces a clear warning or error for broken references.
9. <!-- block: work --> Step with Self-Reference Loop
step_type:: task
next:: Step with Self-Reference Loop
 A task step whose next pointer references itself. Tests that the application detects and handles circular references without crashing.

# <!-- block: concepts --> artifact
* <!-- block: artifact --> Basic Artifact
An artifact with no fields. Tests that the application renders an artifact container with only its name and description.
* <!-- block: artifact --> Artifact with Fields
Tests that the application correctly renders an artifact containing multiple field types. This artifact has no YAML fields — its purpose is to be referenced by steps that exercise the output_status and reference resolution features.
* <!-- block: artifact --> Artifact as Input Only
An artifact that is only consumed (referenced as input) by steps, never produced as output. Tests unidirectional flow in artifact usage.
* <!-- block: artifact --> Artifact as Output Only
An artifact that is only produced (referenced as output) by steps, never consumed as input. Tests unidirectional flow in artifact creation.
* <!-- block: artifact --> Artifact Referenced by Decision
An artifact that is produced by a decision step's output. Tests that artifacts linked to decision-type steps render correctly.
* <!-- block: artifact --> Artifact Never Referenced
An artifact defined in the model but never referenced by any step. Tests that unreferenced artifacts render without errors.

# <!-- block: concepts --> tools
* <!-- block: tools --> Test Runner
A command-line or CI/CD tool that executes automated test suites. Used to validate artifact outputs against expected results.
* <!-- block: tools --> Mockup Editor
A visual design tool used to create and modify artifact previews and mockups during drafting steps.
* <!-- block: tools --> Code Review Platform
A collaborative review tool where artifacts (code diffs, documents) are reviewed and approved before finalization.

# <!-- block: matrices --> item-markers matrix
| Item \ Marker | complexity |
| :--- | :---: |
| Role with No Fields | - |
| Role with Scope Internal | - |
| Role with Scope External | - |
| Role with Relations | - |
| Role as Orphan | - |
| Basic Step | 1 |
| Step with All References | 3 |
| Decision Step with Branching | 2 |
| Step Outputting Final Artifact | 1 |
| Event Step External Trigger | 2 |
| Step with Multiple Inputs | 2 |
| Step with No Next (Terminal) | 1 |
| Step Referencing Nonexistent Artifact | 3 |
| Step with Self-Reference Loop | 3 |
| Basic Artifact | 1 |
| Artifact with Fields | 2 |
| Artifact as Input Only | 1 |
| Artifact as Output Only | 1 |
| Artifact Referenced by Decision | 2 |
| Artifact Never Referenced | 1 |

# <!-- block: matrices --> metamatrix
| Matrix Name | Source | Target | Widget Type | Widget Parameters |
| :--- | :--- | :--- | :--- | :--- |
| work-roles matrix | steps | roles | cycle | Responsible;Accountable;Consulted;Informed |
| work-tools matrix | steps | tools | cycle | Uses |
| work-artifacts matrix | steps | artifact | cycle | Creates;Modifies;Validates;Reviews |
| item-markers matrix | elements | markers | cycle | - |

# <!-- block: matrices --> work-roles matrix
| work \ roles | Role with No Fields | Role with Scope Internal | Role with Scope External | Role with Relations | Role as Orphan |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Basic Step | - | - | - | Responsible | - |
| Step with All References | - | Accountable | - | Consulted | - |
| Decision Step with Branching | - | - | Informed | Responsible | - |
| Step Outputting Final Artifact | - | - | - | Accountable | - |
| Event Step External Trigger | - | Responsible | - | - | - |
| Step with Multiple Inputs | - | - | - | Consulted | - |
| Step with No Next (Terminal) | - | - | - | Informed | - |
| Step Referencing Nonexistent Artifact | - | - | - | Responsible | - |
| Step with Self-Reference Loop | - | - | - | Accountable | - |

# <!-- block: matrices --> work-tools matrix
| work \ tools | Test Runner | Mockup Editor | Code Review Platform |
| :--- | :---: | :---: | :---: |
| Basic Step | - | - | - |
| Step with All References | Uses | - | - |
| Decision Step with Branching | - | - | - |
| Step Outputting Final Artifact | - | - | - |
| Event Step External Trigger | - | - | - |
| Step with Multiple Inputs | - | Uses | - |
| Step with No Next (Terminal) | - | - | - |
| Step Referencing Nonexistent Artifact | - | - | - |
| Step with Self-Reference Loop | - | - | - |

# <!-- block: matrices --> work-artifacts matrix
| work \ artifacts | Basic Artifact | Artifact with Fields | Artifact as Input Only | Artifact as Output Only | Artifact Referenced by Decision | Artifact Never Referenced |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Basic Step | - | - | - | - | - | - |
| Step with All References | Modifies | Creates | - | - | - | - |
| Decision Step with Branching | - | - | - | - | Reviews | - |
| Step Outputting Final Artifact | - | Creates | - | - | - | - |
| Event Step External Trigger | - | - | - | Modifies | - | - |
| Step with Multiple Inputs | Modifies | - | - | - | - | - |
| Step with No Next (Terminal) | - | Creates | - | - | - | - |
| Step Referencing Nonexistent Artifact | - | - | - | - | - | - |
| Step with Self-Reference Loop | - | - | - | - | - | - |

# <!-- block: matrices --> item-markers matrix
| elements \ markers | complexity |
| :--- | :---: |
| Role with No Fields | - |
| Role with Scope Internal | - |
| Role with Scope External | - |
| Role with Relations | - |
| Role as Orphan | - |
| Basic Step | 1 |
| Step with All References | 3 |
| Decision Step with Branching | 2 |
| Step Outputting Final Artifact | 1 |
| Event Step External Trigger | 2 |
| Step with Multiple Inputs | 2 |
| Step with No Next (Terminal) | 1 |
| Step Referencing Nonexistent Artifact | 3 |
| Step with Self-Reference Loop | 3 |
| Basic Artifact | 1 |
| Artifact with Fields | 2 |
| Artifact as Input Only | 1 |
| Artifact as Output Only | 1 |
| Artifact Referenced by Decision | 2 |
| Artifact Never Referenced | 1 |
| Test Runner | 1 |
| Mockup Editor | 1 |
| Code Review Platform | 2 |