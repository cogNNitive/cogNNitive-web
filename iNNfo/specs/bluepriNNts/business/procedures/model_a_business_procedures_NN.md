---
level: 3
parent_spec:
  name: "procedures_V_0-5-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Modeling a Business"
---

# NN Work

## NN Work: Modeling a Business
step_type:: task
condition:: You have a business to describe end to end
input:: [[Business Model]]
output:: [[Validated Business Model]]
tool:: [[Console]]
scope:: internal
Walk the business from its segments to its numbers, gating each step on the previous one. The business-model, analysis, organization, projects and metrics apps each own a piece; this procedure is the order that makes the pieces a model.

## NN Work: Name the Segments and the Value Proposition
parent:: [[Modeling a Business]]
step_type:: task
next:: [[Close the Exchange]]
condition:: No Customer segments declared yet
input:: [[Business Model]]
output:: [[Customer segments]]
tool:: [[Console]]
scope:: internal
Declare the Customer segments, the Value propositions and the Problems they address. Do not open Analysis yet: a suggestion with no segment to serve is noise.

## NN Work: Close the Exchange
parent:: [[Modeling a Business]]
step_type:: gate
next:: [[Describe the Capabilities]]
condition:: Every Customer segment has at least one Contribution and one Compensation
input:: [[Customer segments]]
output:: [[Balanced exchange]]
tool:: [[Console]]
scope:: internal
GATE. Contributions and Compensations are the two halves of the same exchange (business-model guidance). A contribution with no compensation is an unpriced dependency, and the model is not ready to describe capabilities until every segment is closed on both sides.

## NN Work: Describe the Capabilities
parent:: [[Modeling a Business]]
step_type:: task
next:: [[Test the Analysis]]
condition:: The exchange is closed for every segment
input:: [[Balanced exchange]]
output:: [[Keys and Resources]]
tool:: [[Console]]
scope:: internal
Declare the Keys, Resources and Activities that deliver the value proposition, and the Key partners that supply what the venture does not own.

## NN Work: Test the Analysis
parent:: [[Modeling a Business]]
step_type:: gate
next:: [[Staff the Model]]
condition:: Every Key and Suggestion has a Validation entry or is marked a hypothesis
input:: [[Keys and Resources]]
output:: [[Validated Business Model]]
tool:: [[Console]]
scope:: internal
GATE. Analysis guidance requires evidence behind each claim: a Key with no validation entry is a hypothesis, and the model must say so rather than present it as fact. Run the validation procedure before moving on.

## NN Work: Staff the Model
parent:: [[Modeling a Business]]
step_type:: task
next:: [[Quantify the Model]]
condition:: The capabilities the venture must own are known
input:: [[Keys and Resources]]
output:: [[Organization chart]]
tool:: [[Console]]
scope:: internal
Assign the roles that own each capability. The organization app's Project roles guidance applies here: name the decision a role owns, never the activities it performs.

## NN Work: Quantify the Model
parent:: [[Modeling a Business]]
step_type:: task
next:: [[Plan the Delivery]]
condition:: Roles and capabilities are declared
input:: [[Organization chart]]
output:: [[Measured business]]
tool:: [[Console]]
scope:: internal
Populate the metrics app with the variables and the revenue model. A metric that no Key or Contribution justifies is a number looking for a reason.

## NN Work: Plan the Delivery
parent:: [[Modeling a Business]]
step_type:: task
next:: [[Review the Model]]
condition:: The model has at least one quantified goal
input:: [[Measured business]]
output:: [[Project plan]]
tool:: [[Console]]
scope:: internal
Create the project and its milestones with the projects app, ordering the Phases with the `order` field. Each milestone should name the artifact that proves it.

## NN Work: Review the Model
parent:: [[Modeling a Business]]
step_type:: gate
condition:: Every gate above was passed
input:: [[Project plan]]
output:: [[Validated Business Model]]
tool:: [[Console]]
scope:: internal
GATE. Run validation over the whole domain and read the diagnostics. A model that still reports PARENT_CONCEPT_GUIDANCE_INCOMPLETE or a dangling reference is not finished; fix it at the source blueprint or in the model, never by silencing the check.
