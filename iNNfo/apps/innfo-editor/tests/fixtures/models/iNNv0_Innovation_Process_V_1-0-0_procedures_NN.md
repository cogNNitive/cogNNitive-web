---
spec_version: "V_0-1-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/v0.1.1/specs/procedures_V_0-1-1_NN.md"
knowledge_version: "V_1-0-0"
level: 3
parent:
  name: "procedures_V_0-1-1"
  url: "http://localhost:3001/specs/procedures_V_0-1-1_NN.md"
mode: "FILE"
template: "procedures"
---
> [!NOTE]> This is a **FORMAT document** Gï¿½ï¿½ a plain-text Markdown file that carries its own schema in the YAML frontmatter. New to FORMAT? The [onboarding guide](https://format.innv0.com/docs/onboarding) walks you through what this is and how to open it in the visual editor.
# NN index
* [[procedure]]
* [[roles]]
* [[work]]
* [[artifact]]
* [[tools]]
* [[position]]
* [[person]]
# NN procedureThe iNNv0 innovation process is an early-stage innovation management framework structured in two dimensions: **Design** (strategic foundations) and **Execution** (tactical implementation). It focuses on identifying and implementing high-value innovation opportunities with minimal resources, enabling organizations to start building innovation capacity immediately.The process follows a sequential path: assess maturity, describe the organization, plan innovation management, design programs, manage opportunities, and track initiatives. Each step feeds into the next, with AI-powered tools accelerating diagnostics, opportunity identification, ideation, and process optimization.
# NN roles
## NN roles: Innovation Manager
scope:: internal
Drives the overall innovation process, coordinates across dimensions, and ensures alignment with strategic goals.
## NN roles: Team Member
scope:: internal
Participates in assessments, ideation, and execution of innovation initiatives within the organization.
## NN roles: External Consultant
scope:: external
Provides specialized expertise, facilitates maturity assessments, and guides program design from an outside perspective.
## NN roles: Stakeholder
scope:: external
Sponsors innovation efforts, provides strategic direction, and validates outcomes against business objectives.
# NN work
1. _NN work: Assess Innovation Maturity
step_type:: task
next:: Describe Organization
tool:: assessmeNNt
output:: Maturity Assessment Report
output_status:: final
Conduct a focused diagnosis using the assessmeNNt tool to determine the organization's current state of maturity in innovation management. AI-powered assessment forms enable quick, accurate diagnostics.
2. _NN work: Describe Organization
step_type:: task
next:: Plan Innovation Management
input:: Maturity Assessment Report
tool:: organizatioNN
output:: Organization Description Document
output_status:: final
Analyze the current business model, organizational culture, and key capabilities using the organizatioNN tool. Establishes the baseline for strategic planning.
3. _NN work: Plan Innovation Management
step_type:: task
next:: Design Innovation Programs
input:: Organization Description Document
tool:: plaNN
output:: Innovation Management Plan
output_status:: final
Create a simple, actionable strategic roadmap using the plaNN tool to elevate the organization's innovation maturity level. Aligns innovation efforts with company vision and goals.
4. _NN work: Design Innovation Programs
step_type:: task
next:: Manage Opportunities
input:: Innovation Management Plan
tool:: desigNN
output:: Program Design Document
output_status:: final
Structure the initial tactical programs that will drive innovation using the desigNN tool. Defines scope, resources, and expected outcomes for each program.
5. _NN work: Identify and Manage Opportunities
step_type:: task
next:: Track and Execute Initiatives
input:: Program Design Document
tool:: opportuNNities
output:: Opportunities Registry
output_status:: final
Systematically identify obvious and easily accessible innovation opportunities using the opportuNNities tool. AI processes large volumes of data to pinpoint high-value, low-risk opportunities.
6. _NN work: Track and Execute Initiatives
step_type:: task
input:: Opportunities Registry
tool:: iNNitiatives
output:: Initiative Tracking Board
output_status:: draft
Use agile tracking to develop selected opportunities into concrete projects using the iNNitiatives tool. AI assists with ideation, process optimization, and reduces the learning curve.
# NN artifact
## NN artifact: Maturity Assessment Report
Output of the maturity assessment step. Contains the organization's current innovation maturity level, strengths, gaps, and prioritized improvement areas.
## NN artifact: Organization Description Document
Captures the business model analysis, organizational culture assessment, and key capabilities inventory. Serves as the baseline for strategic planning.
## NN artifact: Innovation Management Plan
Strategic roadmap outlining initiatives, timelines, resources, and expected maturity progression. Aligns innovation goals with business strategy.
## NN artifact: Program Design Document
Defines the structure, scope, and resourcing of each innovation program. Includes success criteria, milestones, and assigned responsibilities.
## NN artifact: Opportunities Registry
Curated list of identified innovation opportunities with prioritization scores, resource estimates, and potential impact assessments.
## NN artifact: Initiative Tracking Board
Agile board tracking the development of selected opportunities into concrete projects. Includes status, blockers, progress metrics, and deliverables.
# NN tools
## NN tools: assessmeNNt
AI-powered assessment tool that conducts quick, accurate diagnosis of an organization's maturity level in innovation management.
## NN tools: organizatioNN
Tool for concise analysis of the current business model, organizational culture, and key capabilities. Establishes the innovation baseline.
## NN tools: plaNN
Strategic planning tool that generates a simple, actionable roadmap to elevate the organization's innovation maturity level.
## NN tools: desigNN
Tool for structuring initial innovation programs, defining scope, resources, and expected outcomes.
## NN tools: opportuNNities
Systematic opportunity identification tool that leverages AI to process data, identify patterns and trends, and pinpoint high-value, low-risk opportunities.
## NN tools: iNNitiatives
Agile tracking tool that manages the development of selected opportunities into concrete projects with AI-assisted ideation and process optimization.
# NN position
## NN position: Innovation Lead
Owns the end-to-end innovation process. Coordinates between Design and Execution dimensions and reports to stakeholders.
## NN position: Program Manager
Manages individual innovation programs within the Execution dimension. Tracks initiatives, resources, and timelines.
## NN position: Innovation Analyst
Conducts maturity assessments, organization descriptions, and opportunity identification. Operates the AI tools.
## NN position: Domain Expert
Provides subject matter expertise during opportunity assessment and program design. May be internal or external.
# NN person
## NN person: Alex Chen
Innovation Lead responsible for the overall process. Coordinates across both dimensions and ensures strategic alignment.
## NN person: Sam Rivera
Program Manager overseeing the execution of innovation programs and tracking initiative progress.
## NN person: Jordan Taylor
Innovation Analyst operating the AI tools (assessmeNNt, organizatioNN, opportuNNities) and producing assessment outputs.
## NN person: Pat Morgan
Domain Expert consulted during opportunity evaluation and program design phases.
# NN matrices: item-markers matrix| Item \ Marker | complexity || :--- | :---: || Innovation Manager | - || Team Member | - || External Consultant | - || Stakeholder | - || Assess Innovation Maturity | 2 || Describe Organization | 2 || Plan Innovation Management | 3 || Design Innovation Programs | 3 || Identify and Manage Opportunities | 2 || Track and Execute Initiatives | 2 || Maturity Assessment Report | 1 || Organization Description Document | 1 || Innovation Management Plan | 3 || Program Design Document | 2 || Opportunities Registry | 2 || Initiative Tracking Board | 2 || assessmeNNt | 1 || organizatioNN | 1 || plaNN | 2 || desigNN | 2 || opportuNNities | 2 || iNNitiatives | 2 || Innovation Lead | - || Program Manager | - || Innovation Analyst | - || Domain Expert | - || Alex Chen | - || Sam Rivera | - || Jordan Taylor | - || Pat Morgan | - |
# NN matrices: metamatrix| Matrix Name | Source | Target | Widget Type | Widget Parameters || :--- | :--- | :--- | :--- | :--- || work-roles matrix | work | roles | cycle | Responsible;Accountable;Consulted;Informed || positions-roles matrix | position | roles | cycle | Assumes || persons-positions matrix | person | position | cycle | Occupies || work-tools matrix | work | tools | cycle | Uses || work-artifacts matrix | work | artifact | cycle | Creates;Modifies;Validates;Reviews || item-markers matrix | elements | markers | cycle | - |
# NN matrices: work-roles matrix| work \ roles | Innovation Manager | Team Member | External Consultant | Stakeholder || :--- | :---: | :---: | :---: | :---: || Assess Innovation Maturity | Accountable | Consulted | Responsible | Informed || Describe Organization | Accountable | Responsible | Consulted | Informed || Plan Innovation Management | Responsible | Consulted | Accountable | Informed || Design Innovation Programs | Consulted | Informed | Responsible | Accountable || Identify and Manage Opportunities | Accountable | Responsible | Consulted | Informed || Track and Execute Initiatives | Accountable | Responsible | Informed | Consulted |
# NN matrices: positions-roles matrix| position \ roles | Innovation Manager | Team Member | External Consultant | Stakeholder || :--- | :---: | :---: | :---: | :---: || Innovation Lead | Assumes | - | - | - || Program Manager | - | Assumes | - | - || Innovation Analyst | - | Assumes | - | - || Domain Expert | - | - | Assumes | - |
# NN matrices: persons-positions matrix| person \ position | Innovation Lead | Program Manager | Innovation Analyst | Domain Expert || :--- | :---: | :---: | :---: | :---: || Alex Chen | Occupies | - | - | - || Sam Rivera | - | Occupies | - | - || Jordan Taylor | - | - | Occupies | - || Pat Morgan | - | - | - | Occupies |
# NN matrices: work-tools matrix| work \ tools | assessmeNNt | organizatioNN | plaNN | desigNN | opportuNNities | iNNitiatives || :--- | :---: | :---: | :---: | :---: | :---: | :---: || Assess Innovation Maturity | Uses | - | - | - | - | - || Describe Organization | - | Uses | - | - | - | - || Plan Innovation Management | - | - | Uses | - | - | - || Design Innovation Programs | - | - | - | Uses | - | - || Identify and Manage Opportunities | - | - | - | - | Uses | - || Track and Execute Initiatives | - | - | - | - | - | Uses |
# NN matrices: work-artifacts matrix| work \ artifacts | Maturity Assessment Report | Organization Description Document | Innovation Management Plan | Program Design Document | Opportunities Registry | Initiative Tracking Board || :--- | :---: | :---: | :---: | :---: | :---: | :---: || Assess Innovation Maturity | Creates | - | - | - | - | - || Describe Organization | Modifies | Creates | - | - | - | - || Plan Innovation Management | - | Modifies | Creates | - | - | - || Design Innovation Programs | - | - | Modifies | Creates | - | - || Identify and Manage Opportunities | - | - | - | Modifies | Creates | - || Track and Execute Initiatives | - | - | - | - | Modifies | Creates |