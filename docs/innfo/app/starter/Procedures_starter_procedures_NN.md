---
specification_version: "V_0-2-0"
specification_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/specs/v0.2.0/level1/iNNfo_V_0-2-0_NN.md"
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/specs/v0.2.0/level2/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_1-0-0"
title: "Procedures Model Starter"
mode: "FILE"
---

> [!NOTE]
> This is a starter model for the **Procedures** template. Replace the placeholder elements below with your own procedure definitions.

# _NN index
* [[Procedure]]
* [[Work]]
* [[Roles]]

# _NN Procedure
* _NN Procedure: My Procedure
  Describe the overall procedure — its purpose, scope, and expected outcomes.

# _NN Work
* _NN Work: Step 1
  Detail the first step of the procedure. Include inputs, outputs, and decision points.
  - step_type: task
  - next: Step 2

* _NN Work: Step 2
  Describe subsequent steps. Add conditions, tool references, and artifact outputs.
  - step_type: decision
  - input: Step 1 output
  - condition: Review passed

# _NN Roles
* _NN Roles: Responsible Role
  Define who performs this work — their scope, responsibilities, and access level.
