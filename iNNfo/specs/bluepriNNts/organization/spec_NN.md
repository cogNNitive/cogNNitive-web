---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
title: "Organization App"
procedures:
  - id: "audit-skill-gaps"
    name: "Audit Skill Gaps"
    path: "procedures/audit_skill_gaps_NN.md"
  - id: "export-team-directory"
    name: "Export Team Directory"
    path: "procedures/export_team_directory_NN.md"
assets:
  - id: "org-chart-layout"
    name: "Organization Chart HTML Layout"
    path: "assets/org_chart_console.html"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Organization]]
  * [[Roles]]
  * [[Functions]]
  * [[Position]]
  * [[Person]]
  * [[Skills]]

# NN Concept Definition

## NN Concept Definition: Organization
icon:: building-2
type:: text
color:: blue
weight:: 100

## NN Concept Definition: Roles
icon:: user-check
type:: list
color:: green
weight:: 60

## NN Concept Definition: Functions
icon:: workflow
type:: list
color:: purple
weight:: 55

## NN Concept Definition: Position
icon:: contact
type:: list
color:: teal
weight:: 50

## NN Concept Definition: Person
icon:: user
type:: list
color:: cyan
weight:: 40

## NN Concept Definition: Skills
icon:: award
type:: list
color:: indigo
weight:: 30

# NN Field Definition

## NN Field Definition: scope
concept:: Roles
type:: select
options:: [internal, external]

## NN Field Definition: position_ref
concept:: Person
type:: reference
target_concepts:: [Position]
description:: Reference to the Position held by the team member.

## NN Field Definition: compensation
concept:: Person
type:: string
description:: Compensation structure, salary, equity, or incentives.

## NN Field Definition: contributions
concept:: Person
type:: string
description:: Primary contributions, role dedication, and key deliverables.

## NN Field Definition: image
concept:: Person
type:: image
description:: Visual portrait or avatar representing the person.

# NN Marker Definition

## NN Marker Definition: complexity
applies_to:: [Element, Concept]
icon:: gauge
color:: green
weight:: 50

# NN Matrix Definition

## NN Matrix Definition: positions-roles matrix
source:: Position
target:: Roles
values:: [Assumes]
widget:: boolean

## NN Matrix Definition: persons-positions matrix
source:: Person
target:: Position
values:: [Occupies]
widget:: boolean

## NN Matrix Definition: Functions-Positions Matrix
source:: Functions
target:: Position
values:: [Assumes]
widget:: boolean
description:: Boolean assignment of which Position assumes responsibility for each Function.

# Organization Template

## A template for modeling organizational structures, roles, functions, positions, skills, and person assignments

## Philosophy

The Organization Template is designed to model the human resource structure of an enterprise or team. It separates the definitions of functional responsibilities (Roles), the operational functions the organization must perform (Functions), organizational seats (Positions), the individuals who fill those seats (Persons), and the competencies those individuals hold (Skills). By decoupling organizational structure from behavioral workflows, it ensures that changes in personnel or job titles do not invalidate process descriptions.

This V_0-2-0 revision absorbs the human-structure concepts that were previously duplicated inside the `business` template — Functions, Skills, and the per-person compensation and contribution details — so that `organization` is the single canonical home for how people and responsibilities are arranged. It is a standalone template: other templates (for example a composed `business-model`) `include` it rather than redeclaring these concepts.

## Objectives

- Provide a standardized structure for representing people, positions, roles, functions, and skills within the iNNfo ecosystem.
- Enable clear mapping of which positions assume which roles via the positions-roles matrix.
- Enable clear mapping of which persons occupy which positions via the persons-positions matrix.
- Enable clear mapping of which positions are responsible for which functions via the Functions-Positions matrix.
- Allow organizational structures to be modeled independently of procedures and business models, and reused by other templates through `includes`.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Organization** | `text` | Description of the overall organization structure and objectives |
| **Roles** | `list` | Functional responsibilities/actors with internal/external scope |
| **Functions** | `list` | High-level operational functions the organization must perform |
| **Position** | `list` | Job titles or seats within the organization |
| **Person** | `list` | Named individuals occupying positions, with compensation and contributions |
| **Contributions** | `weight` | The resources, assets, and inputs individuals bring to the organization's value creation |
| **Compensations** | `weight` | The remuneration, benefits, and rewards individuals receive for their contributions |
| **Skills** | `list` | Competencies held by individuals within the organization |

### Fields

| Field | Concept | Type | Purpose |
|---|---|---|---|
| `scope` | Roles | `select` (internal / external) | Whether the role is internal or external to the organization |
| `position_ref` | Person | `reference` → Position | The Position held by the team member |
| `compensation` | Person | `string` | Compensation structure, salary, equity, or incentives |
| `contributions` | Person | `string` | Primary contributions, role dedication, and key deliverables |

### Markers

| Marker | Purpose |
|---|---|
| `complexity` | Indicates the complexity of a role or position |

### Matrices

| Matrix | Source → Target | Purpose |
|---|---|---|
| Positions-Roles | Position → Roles | Which positions assume which roles |
| Persons-Positions | Person → Position | Who occupies which position |
| Functions-Positions | Functions → Position | Which position is responsible for each function |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Source→target tables |
| Graph edge | ❌ | Not applicable |
| Sequence | ❌ | Not applicable |

## Template

### Level 3 Model Template (Lightweight)

To create an organization model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "organization_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
model_version: "V_x-y-z"
title: "<Organization Name>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index
* [[Organization]]
  * [[Roles]]
  * [[Functions]]
  * [[Position]]
  * [[Person]]
  * [[Skills]]

# NN Organization
Description of the overall organization.

# NN Roles
## NN Roles: Role Name
scope:: internal
Role description.

# NN Functions
## NN Functions: Function Name
Function description.

# NN Position
## NN Position: Position Name
Position description.

# NN Person
## NN Person: Person Name
position_ref:: [[Position Name]]
compensation:: Base salary plus equity.
contributions:: Key deliverables and role dedication.
Person description.

# NN Skills
## NN Skills: Skill Name
Skill description.

# NN matrices: positions-roles matrix
| Position \ Roles | Role Name |
| :--- | :---: |
| Position Name | Assumes |

# NN matrices: persons-positions matrix
| Person \ Position | Position Name |
| :--- | :---: |
| Person Name | Occupies |

# NN matrices: functions-positions matrix
| Functions \ Position | Position Name |
| :--- | :---: |
| Function Name | Assumes |
```

The application will resolve the `parent` URL, download this template, and use its
Concept Definitions, Field Definitions, Marker Definitions, and Matrix Definitions to
validate and render your model.

## Examples

### Canonical Sample

The official sample for this template is at `specs/templates/organization/samples/Ghostbusters_V_0-2-0_organization_NN.md`. It exercises all concept types, lists, and the positions-roles, persons-positions, and functions-positions matrices.

# Concept Guidance Documentation

## Organization

### Summary
Description of the overall organization structure and objectives.

### Description
The Organization concept is the canonical home for a prose description of the enterprise or team: what it is responsible for, how it is structured at a high level, and the objectives that shape its shape. It is a single `text` block — the roles, functions, positions, persons, and skills that give the organization its structure are modeled as their own concepts and related through the matrices.

### Methodologies
**Organizational Chart & Functional Breakdown**
Standard structural modeling mapping top-level enterprise divisions to underlying operational roles and positions.

### Prompts
`Describe the primary mission and high-level structure of the organization.`
`Outline the key operational divisions and executive reporting lines.`

## Roles

### Summary
Functional responsibilities or actors within the organization, each scoped as internal or external.

### Description
A Role is a functional responsibility — a named way of acting within the organization — independent of who performs it or which seat carries it. Decoupling roles from positions and persons means that reorganizations, hiring, and title changes do not invalidate the descriptions of how work is done. Each Role carries a `scope` of `internal` or `external`, and Positions are related to the Roles they assume through the positions-roles matrix.

### Methodologies
**RACI Responsibility Assignment Matrix**
A structured framework for identifying actors as Responsible, Accountable, Consulted, or Informed for organizational functions.

### Prompts
`Enumerate the core functional roles required to operate the business.`
`Specify whether each role is internal to the firm or external.`

## Functions

### Summary
High-level specification of the set of tasks that are necessary to carry out a business activity towards the achievement of a business goal.

### Description
"Function List" in business modeling refers to a high-level specification of the tasks that are necessary to carry out a business activity towards the achievement of a business goal. This list is a crucial component of a business model as it outlines the key functions or tasks that need to be performed to deliver a product or service, create value for customers, and achieve the business objectives.

The function list is typically organized in a logical sequence, starting from the initial stages of the business process to the final stages. Each function or task in the list is clearly defined and includes details such as the resources required, the expected output, and the responsible party or department.

For example, in a manufacturing business, the function list might include tasks such as sourcing raw materials, production, quality control, packaging, distribution, and customer service. Each of these tasks is essential for the business to produce and deliver its products to the customers.

The function list is not just a to-do list; it is a strategic tool that helps businesses to plan and manage their operations efficiently. It allows businesses to identify the key activities that drive value creation and focus their resources and efforts on these activities. It also helps to identify potential bottlenecks or inefficiencies in the business process and find ways to improve them.

Moreover, the function list can be used as a communication tool to clarify roles and responsibilities within the organization and ensure that everyone understands what needs to be done to achieve the business goals.

In conclusion, the "Function List" concept in business modeling is a vital tool that helps businesses to plan, manage, and optimize their operations towards the achievement of their business goals.

### Methodologies
**Business Process Modeling Notation (BPMN)**
BPMN is a graphical representation for specifying business processes in a business process model. It provides businesses with a standard method of illustrating the flow of activities (functions) in a process, making it easier to understand and improve.
**Value Stream Mapping**
This lean-management method is used for analyzing the current state and designing a future state for the series of events that take a product or service from its beginning through to the customer. It helps to visualize and understand the flow of material and information as a product or service makes its way through the value stream.
**Gantt Chart**
A Gantt chart is a type of bar chart that illustrates a project schedule. This chart lists the tasks to be performed on the vertical axis, and time intervals on the horizontal axis. The width of the horizontal bars in the graph shows the duration of each activity.
**Work Breakdown Structure (WBS)**
WBS is a key project deliverable that organizes the team's work into manageable sections. The Project Management Body of Knowledge (PMBOK) defines the work breakdown structure as a "hierarchical decomposition of the total scope of work to be carried out by the project team to accomplish the project objectives and create the required deliverables."
**Critical Path Method (CPM)**
CPM is an algorithm for scheduling a set of project activities. It is a step-by-step project management technique to identify activities on the critical path. It is an approach to project scheduling that allows the project manager to manage the trade-off between the time and cost necessary to complete the project.
**Lean Six Sigma**
Lean Six Sigma is a method that relies on a collaborative team effort to improve performance by systematically removing waste and reducing variation. It combines lean manufacturing/lean enterprise and Six Sigma to eliminate the eight kinds of waste: Defects, Over-Production, Waiting, Non-Utilized Talent, Transportation, Inventory, Motion, and Extra-Processing.

### Prompts
`Define the key functional areas (e.g., Finance, Sales, R&D) and their primary responsibilities.`
`Describe how functions collaborate and hand off work.`
`Identify any gaps or overlaps between functions.`
`Propose governance or coordination mechanisms to improve cross-functional alignment.`
`Recommend performance metrics to evaluate each function's effectiveness.`

## Position

### Summary
Job titles or seats within the organization that assume roles and take responsibility for functions.

### Description
A Position is an organizational seat — a job title that exists whether or not it is currently filled. Positions assume Roles (via the positions-roles matrix), are held responsible for Functions (via the Functions-Positions matrix), and are occupied by Persons (via the persons-positions matrix). Modeling positions separately from persons keeps the org chart stable across personnel changes.

### Methodologies
**Job Architecture & Position Classification**
Defining formal seats, title bands, and job descriptions within an enterprise structure.

### Prompts
`List the formal positions and job titles within the organization.`
`Map each position to the roles it assumes and the functions it oversees.`

## Person

### Summary
Named individuals occupying positions, with their compensation and contributions recorded.

### Description
A Person is a physical individual who occupies a Position. Beyond the occupancy relationship, a Person carries `position_ref` (a reference to the held Position), `compensation` (the remuneration structure), and `contributions` (the primary deliverables and role dedication). Persons are related to their Skills so the organization can reason about the competencies it holds.

### Methodologies
**Talent Allocation & Human Resource Information Systems (HRIS)**
Tracking individual team members, seat assignments, performance contributions, and compensation packages.

### Prompts
`Identify key personnel and their assigned position references.`
`Detail individual contributions and compensation structures.`

## Skills

### Summary
The unique identification and competencies of individuals within a team.

### Description
"Skills" in business modeling refers to the unique identification and competencies of individuals within a business model. This concept is crucial in business design as it helps businesses understand the unique value each individual brings to the organization and informs strategic decisions about talent acquisition, development, and management.

Here are the key aspects of "Skills" in business modeling:

- Unique Identification: This involves assigning a unique identifier to each individual in the organization. This allows for accurate tracking and management of individuals, which is essential for effective human resource management.

- Skills and Competencies: This refers to the specific abilities and knowledge that an individual possesses. Understanding the skills and competencies of each individual helps the organization to effectively allocate resources, assign tasks, and develop talent.

- Talent Acquisition: This involves the strategies used to attract and recruit individuals with the necessary skills and competencies. The more effectively a business can acquire talent, the more successful it will be.

- Talent Development: This refers to the strategies used to enhance the skills and competencies of individuals within the organization. This not only improves the performance of the individual but also increases the overall capability of the organization.

- Talent Management: This involves the strategies used to retain, motivate, and manage individuals within the organization. Effective talent management can increase employee satisfaction, reduce turnover, and improve organizational performance.

By understanding and optimizing these aspects of "Skills", a business can maximize the value of its human resources. For instance, a tech company might invest in training and development programs to enhance the skills of its employees, thereby increasing the overall capability of the organization. This would demonstrate the company's ability to leverage "Skills" to drive its business model and create value.

### Methodologies
**Skills Matrix**
A Skills Matrix is a tool that helps to identify the skills and competencies of individuals within a business model. It provides a visual representation of the skills each person possesses, allowing for easy identification of skill gaps and areas for development. This can be particularly useful in planning for future needs and in identifying training opportunities.
**Competency Framework**
A Competency Framework is a structure that sets out and defines the specific skills and competencies required by individuals within a business model. It provides a clear guide for both individuals and managers about what is expected in terms of performance and can be used to identify areas for development and to plan for future needs.
**360-Degree Feedback**
This is a method of performance appraisal that involves feedback from all directions: superiors, peers, and subordinates. It provides a comprehensive view of an individual's skills and competencies within a business model. This tool can be used to identify areas of strength and areas for development.
**Personal Development Plan (PDP)**
A PDP is a tool used by individuals to reflect on their skills, performance and achievements, and to plan for their personal, educational and career development. Within a business model, it can be used to identify the skills and competencies of individuals and to plan for their future development.
**Talent Management System**
This is a technology tool that is used to plan, attract, develop, select, and retain talented individuals. Within a business model, it can be used to identify the skills and competencies of individuals and to manage their development and progression within the organization.
**Job Analysis**
This is a systematic process of collecting information about a job. A job analysis might include: the skills and competencies required to perform the job, the job's context and environment, the tools and technologies used in the job, and the relationships between the job and other jobs. This tool can be used to identify the skills and competencies required by individuals within a business model.

### Prompts
`Enumerate the critical skills required for each key role.`
`Perform a skill-gap analysis comparing current vs. needed competencies.`
`Design a training or development plan to close gaps.`
`Recommend external hiring or partnerships to acquire missing skills.`
`Define metrics to measure skill development and proficiency over time.`
