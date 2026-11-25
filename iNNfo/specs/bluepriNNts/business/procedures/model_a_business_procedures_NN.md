---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Modeling a Business"
---

# NN Work

## NN Work: Modeling a Business
slug:: modeling-a-business
step_type:: task
condition:: You have a business to describe end to end
input:: @business-model
output:: @validated-business-model
tool:: @console
executor:: human
scope:: internal
Walk the business from its segments to its numbers, gating each step on the previous one. The business-model, analysis, organization, projects and metrics apps each own a piece; this procedure is the order that makes the pieces a model.

## NN Work: Name the Segments and the Value Proposition
slug:: name-the-segments-and-the-value-proposition
parent:: @modeling-a-business
step_type:: task
next:: @close-the-exchange
condition:: No Customer segments declared yet
input:: @business-model
output:: [@customer-segments, @balanced-exchange]
tool:: @console
executor:: human
scope:: internal
Declare the Customer segments, the Value propositions and the Problems they address, and for each segment the Contributions it makes and the Compensations it receives. Do not open Analysis yet: a suggestion with no segment to serve is noise.

## NN Work: Close the Exchange
slug:: close-the-exchange
parent:: @modeling-a-business
step_type:: decision
next:: [@describe-the-capabilities, @close-the-open-segments]
condition:: Every Customer segment has at least one Contribution and one Compensation
input:: @balanced-exchange
tool:: @console
executor:: human
decision:: Is the exchange closed: does every Customer segment have at least one Contribution and one Compensation?
scope:: internal
GATE. Contributions and Compensations are the two halves of the same exchange (business-model guidance). A contribution with no compensation is an unpriced dependency, and the model is not ready to describe capabilities until every segment is closed on both sides. Record the outcome `closed` or `open`: an open exchange goes back to its segments, never forward.

## NN Work: Close the Open Segments
slug:: close-the-open-segments
parent:: @modeling-a-business
step_type:: task
next:: @close-the-exchange
condition:: outcome == open
input:: @balanced-exchange
tool:: @console
executor:: human
scope:: internal
Add the missing Contribution or Compensation to every segment the gate found open, then take the exchange back to the gate.

## NN Work: Describe the Capabilities
slug:: describe-the-capabilities
parent:: @modeling-a-business
step_type:: task
next:: @test-the-analysis
condition:: outcome == closed
input:: @balanced-exchange
output:: @keys-and-resources
tool:: @console
executor:: human
scope:: internal
Declare the Keys, Resources and Activities that deliver the value proposition, and the Key partners that supply what the venture does not own.

## NN Work: Test the Analysis
slug:: test-the-analysis
parent:: @modeling-a-business
step_type:: decision
next:: [@staff-the-model, @record-the-missing-validations]
condition:: Every Key and Suggestion has a Validation entry or is marked a hypothesis
input:: @keys-and-resources
tool:: @console
executor:: human
decision:: Does every Key and Suggestion have a Validation entry, or is it marked a hypothesis?
scope:: internal
GATE. Analysis guidance requires evidence behind each claim: a Key with no validation entry is a hypothesis, and the model must say so rather than present it as fact. Run the validation procedure before moving on. Record the outcome `evidenced` or `unevidenced`.

## NN Work: Record the Missing Validations
slug:: record-the-missing-validations
parent:: @modeling-a-business
step_type:: task
next:: @test-the-analysis
condition:: outcome == unevidenced
input:: @keys-and-resources
tool:: @console
executor:: human
scope:: internal
Give every Key and Suggestion the gate named a Validation entry, or mark it a hypothesis, then take the analysis back to the gate.

## NN Work: Staff the Model
slug:: staff-the-model
parent:: @modeling-a-business
step_type:: task
next:: @quantify-the-model
condition:: outcome == evidenced
input:: @keys-and-resources
output:: @organization-chart
tool:: @console
executor:: human
scope:: internal
Assign the roles that own each capability. The organization app's Project roles guidance applies here: name the decision a role owns, never the activities it performs.

## NN Work: Quantify the Model
slug:: quantify-the-model
parent:: @modeling-a-business
step_type:: task
next:: @plan-the-delivery
condition:: Roles and capabilities are declared
input:: @organization-chart
output:: @measured-business
tool:: @console
executor:: human
scope:: internal
Populate the metrics app with the variables and the revenue model. A metric that no Key or Contribution justifies is a number looking for a reason.

## NN Work: Plan the Delivery
slug:: plan-the-delivery
parent:: @modeling-a-business
step_type:: task
next:: @review-the-model
condition:: The model has at least one quantified goal
input:: @measured-business
output:: @project-plan
tool:: @console
executor:: human
scope:: internal
Create the project and its milestones with the projects app, ordering the Phases with the `order` field. Each milestone should name the artifact that proves it.

## NN Work: Review the Model
slug:: review-the-model
parent:: @modeling-a-business
step_type:: decision
next:: [@confirm-the-validated-model, @fix-the-reported-diagnostics]
condition:: Every gate above was passed
input:: @project-plan
tool:: @console
executor:: human
decision:: Does validation over the whole domain report no PARENT_CONCEPT_GUIDANCE_INCOMPLETE and no dangling reference?
scope:: internal
GATE. Run validation over the whole domain and read the diagnostics. A model that still reports PARENT_CONCEPT_GUIDANCE_INCOMPLETE or a dangling reference is not finished; fix it at the source blueprint or in the model, never by silencing the check. Record the outcome `valid` or `invalid`; only a valid model is recorded as the validated deliverable.

## NN Work: Fix the Reported Diagnostics
slug:: fix-the-reported-diagnostics
parent:: @modeling-a-business
step_type:: task
next:: @review-the-model
condition:: outcome == invalid
input:: @project-plan
tool:: @console
executor:: human
scope:: internal
Fix each reported diagnostic at the source blueprint or in the model, then run the review again.

## NN Work: Confirm the Validated Model
slug:: confirm-the-validated-model
parent:: @modeling-a-business
step_type:: task
condition:: outcome == valid
input:: @project-plan
output:: @validated-business-model
tool:: @console
executor:: human
scope:: internal
Record the whole domain, validated with no incomplete guidance and no dangling reference, as the deliverable.

# NN Tools

## NN Tools: Console
slug:: console
scope:: internal
The domaiNN console, where a person fills the model step by step.

# NN Artifact

## NN Artifact: Business Model
slug:: business-model
The model on the Business blueprint, with the apps it composes.

## NN Artifact: Customer segments
slug:: customer-segments
The Customer segments, Value propositions and Problems they address.

## NN Artifact: Balanced exchange
slug:: balanced-exchange
Every Customer segment closed with at least one Contribution and one Compensation.

## NN Artifact: Keys and Resources
slug:: keys-and-resources
The Keys, Resources, Activities and Key partners that deliver the value proposition.

## NN Artifact: Organization chart
slug:: organization-chart
The roles that own each capability.

## NN Artifact: Measured business
slug:: measured-business
The metrics app variables and the revenue model.

## NN Artifact: Project plan
slug:: project-plan
The project, its milestones and its ordered Phases.

## NN Artifact: Validated Business Model
slug:: validated-business-model
verify:: human
The whole domain, validated with no incomplete guidance and no dangling reference.
