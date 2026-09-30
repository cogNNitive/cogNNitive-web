---
spec_version: "V_0-2-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/main/specs/v0.2.0/level2/organization/organization_V_0-2-0_NN.md"
knowledge_version: "V_1-0-0"
level: 3
parent:
  name: "organization_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/main/specs/v0.2.0/level2/organization/organization_V_0-2-0_NN.md"
mode: "FILE"
template:
  name: "organization"
  version: "V_0-2-0"
  title: "Engineering Team"
  last_updated: "2026-07-11T00:00:00.000Z"
  concepts:
    - name: "organization"
      icon: "building"
      type: "text"
      mode: "basic"
      color: "blue"
      weight: 100
      ai_applicability: 9
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
    - name: "position"
      icon: "briefcase"
      type: "list"
      mode: "basic"
      color: "green"
      weight: 50
      ai_applicability: 7
    - name: "person"
      icon: "user"
      type: "list"
      mode: "basic"
      color: "green"
      weight: 40
      ai_applicability: 6
  markers:
    - name: "complexity"
      icon: "gauge"
      description: "Complexity of the role/position"
      mode: "basic"
      color: "green"
      weight: 50
  matrices:
    - name: "positions-roles matrix"
      source: "position"
      target: "roles"
      params: "Assumes"
    - name: "persons-positions matrix"
      source: "person"
      target: "position"
      params: "Occupies"
    - name: "item-markers matrix"
      source: "elements"
      target: "markers"
title: "Engineering Team"
last_saved: "2026-07-11T12:00:00.000Z"
---
> [!NOTE]
> This is a **FORMAT document** — a plain-text Markdown file that carries its own schema in the YAML frontmatter. New to FORMAT? The [onboarding guide](https://format.innv0.com/docs/onboarding) walks you through what this is and how to open it in the visual editor.

# <!-- block: concepts --> index
* [[roles]]
* [[position]]
* [[person]]

# <!-- block: concepts --> organization
The Core Engineering Team at Acme Corp, responsible for building and maintaining the primary platform APIs, databases, and frontend interfaces.

# <!-- block: concepts --> roles
* <!-- block: roles --> Developer
scope:: internal
Writes code, builds features, and maintains software services.
* <!-- block: roles --> QA Engineer
scope:: internal
Designs test plans, executes tests, and verifies releases.
* <!-- block: roles --> Tech Lead
scope:: internal
Architects solutions, conducts code reviews, and guides engineering decisions.

# <!-- block: concepts --> position
* <!-- block: position --> Senior Developer
Senior software engineering seat focused on core backend services.
* <!-- block: position --> Junior Developer
Associate software engineering seat assisting with feature delivery.
* <!-- block: position --> Lead Tester
Senior QA seat responsible for overall quality control and validation strategies.
* <!-- block: position --> Team Tech Lead
Leadership seat responsible for technical architecture and delivery of the team.

# <!-- block: concepts --> person
* <!-- block: person --> Alice Smith
Senior engineer with extensive experience in distributed systems.
* <!-- block: person --> Bob Jones
Junior engineer who recently joined the platform team.
* <!-- block: person --> Charlie Brown
Experienced tester specializing in automated end-to-end testing.
* <!-- block: person --> Diana Prince
Senior architect and team technical leader.

# <!-- block: matrices --> item-markers matrix
| Item \ Marker | complexity |
| :--- | :---: |
| Developer | - |
| QA Engineer | - |
| Tech Lead | - |
| Senior Developer | 2 |
| Junior Developer | 1 |
| Lead Tester | 2 |
| Team Tech Lead | 3 |
| Alice Smith | 1 |
| Bob Jones | 1 |
| Charlie Brown | 1 |
| Diana Prince | 1 |

# <!-- block: matrices --> metamatrix
| Matrix Name | Source | Target | Widget Type | Widget Parameters |
| :--- | :--- | :--- | :--- | :--- |
| positions-roles matrix | position | roles | cycle | Assumes |
| persons-positions matrix | person | position | cycle | Occupies |
| item-markers matrix | elements | markers | cycle | - |

# <!-- block: matrices --> positions-roles matrix
| position \ roles | Developer | QA Engineer | Tech Lead |
| :--- | :---: | :---: | :---: |
| Senior Developer | Assumes | - | - |
| Junior Developer | Assumes | - | - |
| Lead Tester | - | Assumes | - |
| Team Tech Lead | Assumes | - | Assumes |

# <!-- block: matrices --> persons-positions matrix
| person \ position | Senior Developer | Junior Developer | Lead Tester | Team Tech Lead |
| :--- | :---: | :---: | :---: | :---: |
| Alice Smith | Occupies | - | - | - |
| Bob Jones | - | Occupies | - | - |
| Charlie Brown | - | - | Occupies | - |
| Diana Prince | - | - | - | Occupies |

# <!-- block: matrices --> item-markers matrix
| elements \ markers | complexity |
| :--- | :---: |
| Developer | - |
| QA Engineer | - |
| Tech Lead | - |
| Senior Developer | 2 |
| Junior Developer | 1 |
| Lead Tester | 2 |
| Team Tech Lead | 3 |
| Alice Smith | 1 |
| Bob Jones | 1 |
| Charlie Brown | 1 |
| Diana Prince | 1 |
