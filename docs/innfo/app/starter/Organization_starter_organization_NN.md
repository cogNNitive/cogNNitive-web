---
specification_version: "V_0-2-0"
specification_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/specs/v0.2.0/level1/iNNfo_V_0-2-0_NN.md"
level: 3
parent_spec:
  name: "organization_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/specs/v0.2.0/level2/organization/organization_V_0-2-0_NN.md"
model_version: "V_1-0-0"
title: "Organization Model Starter"
mode: "FILE"
---

> [!NOTE]
> This is a starter model for the **Organization** template. Replace the placeholder elements below with your own organizational definitions.

# _NN index
* [[Organization]]
* [[Roles]]
* [[Position]]
* [[Person]]

# _NN Organization

Describe your organization structure, departments, or teams.

# _NN Roles
* _NN Roles: My Role
  ```yaml
  scope: internal
  ```
  Define functional roles and responsibilities.

# _NN Position
* _NN Position: My Position
  List job titles or seats.

# _NN Person
* _NN Person: My Person
  List individuals.

# _NN matrices: positions-roles matrix
| Position \ Roles | My Role |
| :--- | :---: |
| My Position | Assumes |

# _NN matrices: persons-positions matrix
| Person \ Position | My Position |
| :--- | :---: |
| My Person | Occupies |

# _NN matrices: item-markers matrix
| Element \ Markers | complexity |
| :--- | :---: |
