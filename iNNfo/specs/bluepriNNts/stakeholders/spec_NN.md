---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/stakeholders/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-6-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-6-0_NN.md"
blueprint_version: "V_0-1-0"
title: "Stakeholders Blueprint"
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

# NN index

* [[Stakeholder]]
  * [[Segment]]
    * [[Profile]]
* [[Segmentation criteria]]

# NN Concept Definition

## NN Concept Definition: Stakeholder
icon:: users
type:: list
color:: blue
weight:: 100
storage:: distributed
placement:: "stakeholders/{slug}/"

### Summary
Root aggregate representing an individual, entity, or group with an interest in the organization or initiative.

### Description
A Stakeholder is any party that can affect or be affected by the actions, objectives, and policies of an organization. In this blueprint, Stakeholder is a distributed container model storing high-level alignment, governance categories, and overarching segments.

## NN Concept Definition: Segment
icon:: pie-chart
type:: list
color:: green
weight:: 80

### Summary
Distinct group or niche within a stakeholder category sharing specific attributes, operational context, or market behaviors.

### Description
A Segment partitions a broader stakeholder group into actionable cohorts (for example, Enterprise vs. SMB commercial clients, or Municipal vs. Federal regulators). It functions as a distributed instance model holding specific operational profiles and segmentation criteria evaluations.

## NN Concept Definition: Profile
icon:: user-check
type:: list
color:: teal
weight:: 60

### Summary
Decision-making role, user archetype, or behavioral profile acting within a segment.

### Description
A Profile defines a specific persona archetype or functional participant within a segment (e.g. Chief Financial Officer, Operations Dispatcher, Field Operator). It captures key pain points, decision-making dynamics, and points to an external detailed persona dossier.

## NN Concept Definition: Segmentation criteria
icon:: sliders
type:: list
color:: purple
weight:: 50

### Summary
Evaluation axes and qualification dimensions used to analyze and compare profiles across segments.

### Description
Segmentation criteria provide the formal parameters (demographic, firmographic, operational, or behavioral) used to benchmark profiles. In conjunction with Profile elements, they populate the evaluable Criteria-Profiles matrix.

# NN Field Definition

## NN Field Definition: tags
concept:: *
type:: select
multiple:: true
description:: Open vocabulary classification labels and tags.

<!-- Stakeholder fields -->

## NN Field Definition: category
concept:: Stakeholder
type:: select
options:: [Commercial, Government, Partner, Community, Internal, Investor, Regulatory]
description:: Primary classification of the stakeholder relationship.

## NN Field Definition: influence_level
concept:: Stakeholder
type:: select
options:: [High, Medium, Low]
description:: Degree of strategic or operational influence exerted by the stakeholder.

## NN Field Definition: relationship_model
concept:: Stakeholder
type:: string
description:: High-level engagement or commercial governance model.

<!-- Segment fields -->

## NN Field Definition: stakeholder
concept:: Segment
type:: reference
target_concepts:: [Stakeholder]
description:: Parent stakeholder aggregate to which this cohort belongs.

## NN Field Definition: market_size
concept:: Segment
type:: string
description:: Estimated target size or volume of the cohort.

## NN Field Definition: priority
concept:: Segment
type:: select
options:: [High, Medium, Low]
description:: Operational or commercial priority of the segment.

## NN Field Definition: target_range
concept:: Segment
type:: string
description:: Bounded criteria range defining cohort inclusion.

<!-- Profile fields -->

## NN Field Definition: segment
concept:: Profile
type:: reference
target_concepts:: [Segment]
description:: Parent segment cohort in which this profile operates.

## NN Field Definition: decision_role
concept:: Profile
type:: select
options:: [Economic Buyer, Technical Evaluator, End User, Executive Sponsor, Gatekeeper, Influencer]
description:: Functional buying or decision-making authority of the profile.

## NN Field Definition: persona
concept:: Profile
type:: file
description:: Relative path to an external detailed markdown dossier describing the persona.

## NN Field Definition: pain_points
concept:: Profile
type:: markdown_inline
description:: Critical challenges, unmet needs, or friction experienced by this profile.

<!-- Segmentation criteria fields -->

## NN Field Definition: criterion_type
concept:: Segmentation criteria
type:: select
options:: [Demographic, Behavioral, Firmographic, Operational, Strategic]
description:: Classification category of the evaluation parameter.

# NN Matrix Definition

## NN Matrix Definition: Criteria-Profiles Matrix
source:: Segmentation criteria
target:: Profile
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set
description:: Evaluates the relative intensity or fit of each segmentation criterion against each profile.

# Stakeholders Blueprint

## Domain specification for modular, distributed stakeholder management and profile qualification

## Philosophy

Organizations do not operate in a vacuum: they interact with diverse stakeholders ranging from customers and regulators to investors and community bodies. Rather than entangling audience hierarchies inside monolithic strategy or business models, the `stakeholders` blueprint isolates audience topology into a dedicated, reusable schema.

By establishing distributed instance containers for `Stakeholder` and `Segment`, while keeping `Profile` instances compact, the blueprint balances deep multi-level governance with lightweight authoring and zero file proliferation.

## Template Guidance

## Stakeholder

### Summary
Root aggregate representing an individual, entity, or group with a direct or indirect stake in the organization.

### Description
A Stakeholder is any party that affects or is affected by an organization's decisions and outcomes. In this blueprint, it defines the distributed container holding high-level governance, category, and strategic alignment parameters.

### Methodologies
- Stakeholder Salience Model (Power, Legitimacy, Urgency)
- Mendelow's Power-Interest Matrix
- RACI Matrix for organizational interfaces

### Prompts
`Analyze our key external stakeholders and classify their strategic influence and relationship model.`
`Identify emerging regulatory or community stakeholders that could impact our operations.`

## Segment

### Summary
Distinct cohort or market partition within a stakeholder category sharing common behavioral, operational, or economic traits.

### Description
A Segment groups specific entities within a stakeholder group into actionable subsets (such as Enterprise vs SMB commercial clients, or Municipal vs State authorities). It lives as a distributed instance model containing profiles and criteria evaluations.

### Methodologies
- Behavioral and Firmographic Segmentation
- Job-to-be-Done (JTBD) cohort analysis
- Customer Lifetime Value (LTV) tiering

### Prompts
`Partition our commercial clients into actionable market segments based on size and operational complexity.`
`Define the inclusion criteria and boundary conditions for this stakeholder segment.`

## Profile

### Summary
Decision-making archetype, buyer profile, or functional role acting within a specific segment.

### Description
A Profile captures the concrete participant or decision maker in a segment (e.g. Chief Financial Officer, Head of Compliance). It contains key pain points and links to an external persona dossier.

### Methodologies
- Buyer Persona Framework
- Decision-Making Unit (DMU) mapping
- Empathy Mapping

### Prompts
`Identify the economic buyer, technical evaluator, and end-user profiles within this enterprise segment.`
`Map the top operational pain points and decision criteria for this profile.`

## Segmentation criteria

### Summary
Evaluation dimensions and qualification parameters used to analyze and benchmark profiles.

### Description
Segmentation criteria provide the formal parameters (demographic, behavioral, operational, or strategic) against which profiles are scored in the evaluable matrix.

### Methodologies
- Multi-criteria decision analysis (MCDA)
- Weighted attribute scoring
- Comparative cohort benchmarking

### Prompts
`List the decisive qualification criteria that differentiate buyer profiles in this market.`
`Evaluate the relative intensity and sensitivity of each profile against our strategic criteria.`

