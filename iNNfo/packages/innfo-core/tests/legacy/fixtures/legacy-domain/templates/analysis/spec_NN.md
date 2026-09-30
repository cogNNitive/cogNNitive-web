---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Analysis App"
procedures:
  - id: "run-coherence-audit"
    name: "Run Coherence Audit"
    path: "procedures/run_coherence_audit_NN.md"
  - id: "prioritize-experiments"
    name: "Prioritize Experiments"
    path: "procedures/prioritize_experiments_NN.md"
assets:
  - id: "strategic-audit-layout"
    name: "Strategic Audit HTML Layout"
    path: "assets/strategic_audit_console.html"
relationship_types:
  hierarchy:
    enabled: true
    via: index block
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

* [[Analysis]]
  * [[Assumptions]]
  * [[Risks]]
  * [[Keys]]
  * [[Suggestions]]
* [[Validation]]
  * [[Coherence]]
  * [[Experiments]]

# NN Concept Definition

## NN Concept Definition: Analysis
icon:: microscope
type:: category
color:: red
weight:: 80

## NN Concept Definition: Assumptions
icon:: circle-help
type:: weight
color:: red
weight:: 50

## NN Concept Definition: Risks
icon:: shield-alert
type:: weight
color:: red
weight:: 90

## NN Concept Definition: Suggestions
icon:: messages-square
type:: weight
color:: red
weight:: 30

## NN Concept Definition: Keys
icon:: key-round
type:: weight
color:: red
weight:: 50

## NN Concept Definition: Validation
icon:: clipboard-check
type:: category
color:: green
weight:: 90

## NN Concept Definition: Coherence
icon:: link
type:: weight
color:: green
weight:: 25

## NN Concept Definition: Experiments
icon:: flask-conical
type:: weight
color:: green
weight:: 40

# NN Marker Definition

## NN Marker Definition: importance
applies_to:: [Element]
symbol:: *
icon:: plus
color:: blue

## NN Marker Definition: completion
applies_to:: [Element]
symbol:: >
icon:: check
color:: blue

## NN Marker Definition: certainty
applies_to:: [Element, Concept]
symbol:: ?
icon:: help-circle
color:: green

## NN Marker Definition: priority
applies_to:: [Element]
symbol:: !
icon:: flag
color:: red

## NN Marker Definition: rating
applies_to:: [Element]
symbol:: +
icon:: star
color:: green

# NN Matrix Definition

## NN Matrix Definition: Assumptions-Risks Matrix
source:: Assumptions
target:: Risks
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set
description:: Scores how strongly each Risk threatens each Assumption (risk assessment).

## NN Matrix Definition: Experiments-Assumptions Matrix
source:: Experiments
target:: Assumptions
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set
description:: Scores how much each Experiment validates each Assumption.

# Analysis Template

## A reusable template for the strategic review layer of a business model — assumptions, risks, SWOT, key factors, coherence checks, and validation experiments

## Philosophy

The Analysis Template isolates the *evaluative* half of business modeling from the
*descriptive* half. Where a business model describes what the venture is — its
market, value propositions, operations, and finances — analysis asks whether that
description holds together and where it is most likely to be wrong. It groups the
work into two categories: **Analysis** (surfacing assumptions, risks,
key success factors, and improvement suggestions) and **Validation**
(checking internal coherence and running experiments that turn assumptions into
evidence).

It is a standalone level-2 template. It declares no `includes`; instead, a
composite template such as the `business` umbrella `includes` both this template
and `business-model`. Both halves declare the same five markers
(`importance`, `completion`, `certainty`, `priority`, `rating`) with identical
bodies so that composing them raises no collision — the shared marker set is the
business vocabulary, kept in sync across the two halves.

## Objectives

1. Provide a compact, reusable concept set for the strategic-review layer of any model.
2. Keep assumptions, risks, and experiments explicitly linked through evaluable matrices.
3. Compose cleanly with `business-model` under the `business` umbrella without redeclaring shared vocabulary differently.
4. Be usable on its own as the `parent_spec` of a lightweight analysis-only model.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Analysis** | `category` | Grouping concept for the strategic-review elements |
| **Assumptions** | `weight` | Hypotheses the model depends on, to be validated or invalidated |
| **Risks** | `weight` | Potential negative outcomes that threaten the model |
| **Suggestions** | `weight` | Concrete improvement proposals arising from the review |
| **Keys** | `weight` | Key success factors and critical capabilities |
| **Validation** | `category` | Grouping concept for coherence and experimentation |
| **Coherence** | `weight` | Internal-consistency checks between model components |
| **Experiments** | `weight` | Tests that turn assumptions into evidence |

### Markers

| Marker | Symbol | Purpose |
|---|---|---|
| `importance` | `*` | Core importance score |
| `completion` | `>` | Progress indicator |
| `certainty` | `?` | Confidence level |
| `priority` | `!` | Urgency flag |
| `rating` | `+` | Quality rating |

### Matrices

| Matrix | Source → Target | Purpose |
|---|---|---|
| Assumptions-Risks | Assumptions → Risks | How strongly each risk threatens each assumption |
| Experiments-Assumptions | Experiments → Assumptions | How much each experiment validates each assumption |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Source→target tables |
| Graph edge | ❌ | Not applicable |
| Sequence | ❌ | Not applicable |

## Template

### Level 3 Model Template (Lightweight)

To create an analysis model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "analysis_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
model_version: "V_x-y-z"
title: "<Analysis Name>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN Analysis
## NN Analysis: Strategic Assessment
Overall assessment narrative.

# NN Assumptions
## NN Assumptions: A key assumption.

# NN Risks
## NN Risks: A key risk.

# NN Keys
## NN Keys: A key success factor.

# NN Suggestions
## NN Suggestions: An improvement proposal.

# NN Coherence
## NN Coherence: A consistency check.

# NN Experiments
## NN Experiments: An experiment to run.

# NN matrices: assumptions-risks matrix
| Assumptions \ Risks | A key risk. |
| :--- | :---: |
| A key assumption. | High |

# NN matrices: experiments-assumptions matrix
| Experiments \ Assumptions | A key assumption. |
| :--- | :---: |
| An experiment to run. | High |
```

## Examples

### Canonical Sample

The official sample for this template is at `specs/templates/analysis/samples/Ghostbusters_V_0-2-0_analysis_NN.md`. It exercises Assumptions, Risks, Keys, Suggestions, Coherence, and Experiments and both matrices.

# Concept Guidance Documentation

## Analysis

### Summary
The process of examining and evaluating the different components of the business model to identify their importance and coherence and determine the risks it entails.

### Description
"Analysis" in business modeling refers to the systematic examination and evaluation of the various components of a business model. This process is crucial in identifying the significance and coherence of each element, as well as determining the potential risks associated with the model.

During the analysis phase, each aspect of the business model is scrutinized. This includes the value proposition, customer segments, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure. The goal is to understand how these components interact with each other and contribute to the overall functioning of the business.

For instance, a company might analyze its business model to assess the viability of a new product. This would involve examining the product's potential market, the competition, the proposed revenue streams, the necessary resources and activities, and the potential costs. The analysis might reveal that while the product has a large potential market, the competition is fierce and the cost structure is high, making the product risky.

The analysis phase is not only about identifying potential risks, but also about finding opportunities for improvement and innovation. It can reveal inefficiencies in the business model, areas for cost reduction, potential new revenue streams, and opportunities for better serving customers.

In essence, "Analysis" in business modeling is about understanding a business model in depth. It is a critical aspect of business design, as it directly impacts the ability of a business to mitigate risks, seize opportunities, and ultimately, achieve success.

### Methodologies
**SWOT Analysis**
The SWOT analysis (Strengths, Weaknesses, Opportunities, Threats) is a tool that can be used to analyze the different components of a business model. It helps to identify the strengths and weaknesses of the business model, as well as the opportunities and threats it faces. This analysis can help to identify the risks associated with the business model and determine its coherence and importance.

**PESTEL Analysis**
The PESTEL analysis (Political, Economic, Social, Technological, Environmental, Legal) is a tool that can be used to analyze the external macro-environmental factors that affect an organization. It can be used to understand the risks and opportunities presented by these factors and how they impact the business model.

**Value Chain Analysis**
This tool, developed by Michael Porter, is used to analyze the activities that a business performs in order to deliver a valuable product or service to the market. It helps to identify the key activities that create value in the business model and evaluate their importance and coherence.

**Business Model Canvas**
The Business Model Canvas, developed by Alexander Osterwalder, is a tool that can be used to visualize and analyze a business model. It includes nine key components, including value proposition, customer segments, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure. This tool can be used to examine and evaluate these components to identify their importance and coherence and determine the risks they entail.

**Gap Analysis**
Gap Analysis is a tool that can be used to compare the current state of the business model with the desired future state. It helps to identify the gaps in the business model and develop strategies to close these gaps. This analysis can help to identify the risks associated with the business model and determine its coherence and importance.

**Scenario Planning**
Scenario Planning is a tool that can be used to analyze the potential future scenarios that could impact the business model. It helps to identify the risks and opportunities associated with these scenarios and develop strategies to manage them. This tool can be used to examine and evaluate the different components of the business model to identify their importance and coherence.

### Prompts
`Conduct a coherence analysis linking value proposition, segments, and revenue streams.`
`Identify gaps or misalignments in our business model components.`
`Prioritize components by strategic importance and risk level.`
`Recommend corrective actions to improve model coherence.`
`Develop a roadmap for iterative validation and refinement of analysis findings.`

---

## Assumptions

### Summary
Assumptions refer to the hypotheses or beliefs that underpin a business idea or model. These are the uncertain elements about customers, markets, or products that must be validated to ensure the viability and success of the business.

### Description
"Assumption List" in business modeling refers to a list of hypotheses or beliefs that the entrepreneurial team holds to be true and relevant to their business. These assumptions are often based on the team's understanding of the market, the customer, the product or service, and the business environment. They serve as the foundation upon which the business model is built and are used to guide decision-making and strategy development.

Here are the key aspects of "Assumption List" in business modeling:

- Market Assumptions: These are assumptions about the market in which the business operates, including the size of the market, the growth rate, the level of competition, and the market trends. For example, a startup might assume that the market for their product is growing at a rate of 10% per year.
- Customer Assumptions: These are assumptions about the customers that the business serves, including their needs, preferences, behaviors, and willingness to pay. For example, a business might assume that their customers value quality over price.
- Product or Service Assumptions: These are assumptions about the product or service that the business offers, including its functionality, value proposition, and competitive advantage. For example, a tech company might assume that their software is more user-friendly than the competition.
- Business Environment Assumptions: These are assumptions about the broader business environment, including the regulatory environment, the economic environment, and the technological environment. For example, a business might assume that there will be no significant regulatory changes in the next few years.
- Financial Assumptions: These are assumptions about the financial aspects of the business, including the cost structure, the revenue model, and the profitability. For example, a business might assume that their cost of goods sold will decrease over time due to economies of scale.

It's important to note that while assumptions are necessary to move forward with a business model, they should be validated or invalidated as soon as possible through market research, customer feedback, and other forms of testing. This helps to reduce risk and uncertainty, and allows the business to adapt its model based on real-world evidence.

### Methodologies
**Lean Startup Methodology**
The Lean Startup methodology, developed by Eric Ries, heavily emphasizes the importance of making assumptions and then testing them. The assumption list is a key component of this methodology. The entrepreneurial team lists their assumptions about their business model and then designs experiments to validate or invalidate these assumptions.
**Business Model Canvas**
While the Business Model Canvas does not explicitly include an assumption list, it is often used in conjunction with one. The entrepreneurial team can list their assumptions about each of the nine components of the canvas and then test these assumptions through customer discovery and validation.
**Value Proposition Canvas**
Similar to the Business Model Canvas, the Value Proposition Canvas can be used in conjunction with an assumption list. The entrepreneurial team can make assumptions about the customer profile and value map and then test these assumptions.
**Customer Development Model**
The Customer Development Model, developed by Steve Blank, is a four-step framework that emphasizes the importance of making and testing assumptions. The assumption list is a key component of the first step, customer discovery.
**Pivot or Persevere**
This tool, also from the Lean Startup methodology, is used after assumptions have been tested. If an assumption is invalidated, the entrepreneurial team must decide whether to pivot (change a fundamental part of the business model) or persevere (keep testing the current model). The assumption list is a critical input to this decision.
**Assumption Mapping**
This tool, developed by David Bland, is specifically designed to help teams identify and test their riskiest assumptions. The assumption list is a key component of this tool. The team lists their assumptions and then maps them based on their level of uncertainty and the impact on the business if the assumption is wrong.

### Prompts
`List the key assumptions in our financial and customer forecasts.`
`Classify assumptions by level of uncertainty and impact.`
`Design experiments or data collection methods to test top 5 assumptions.`
`Define success criteria and metrics for each assumption test.`
`Outline a timeline and responsible teams for assumption validation.`

---

## Risks

### Summary
Potential negative outcomes or uncertainties that may affect the success and sustainability of a business model.

### Description
a Risks in business modeling refers to the identification and documentation of potential negative outcomes or uncertainties that may affect the success and sustainability of a business model. This concept is rooted in the understanding that every business operates in an environment of uncertainty and risk, and that proactive risk management is crucial for business survival and growth.

In the context of business design, a Risks can take many forms. It could be a list of potential market risks such as changes in customer preferences, competitive threats, or regulatory changes. It could also include operational risks such as supply chain disruptions, technology failures, or talent shortages. Financial risks such as currency fluctuations, interest rate changes, or liquidity issues may also be included. 

The Risk List serves several key functions in business modeling. Firstly, it helps to identify and prioritize risks, enabling businesses to focus their resources and efforts on the most significant threats. By understanding the potential impact and likelihood of each risk, businesses can make informed decisions about risk mitigation strategies.

Secondly, a Risk List can facilitate proactive risk management. By identifying potential risks early, businesses can take steps to prevent or reduce their impact, rather than reacting to them after they occur. This can enhance business resilience, reduce costs, and protect business value.

Thirdly, a Risk List can enhance strategic planning and decision-making. By considering potential risks in their strategic planning, businesses can develop more robust and resilient strategies that take into account the full range of uncertainties they face.

Lastly, a Risk List can improve stakeholder communication and trust. By transparently communicating about potential risks and their management strategies, businesses can build trust with stakeholders, including investors, customers, employees, and regulators.

In summary, the Risk List model in business design is a strategic approach that involves identifying, documenting, and managing potential negative outcomes or uncertainties that may affect the success and sustainability of a business model. It is a crucial tool for enhancing business resilience, strategic planning, stakeholder communication, and overall business performance.

### Methodologies
**Risk Management Plan**
A Risk Management Plan is a document that a project manager prepares to foresee risks, estimate impacts, and define responses to issues. It also contains a risk assessment matrix. A risk is "an uncertain event or condition that, if it occurs, has a positive or negative effect on a project’s objectives." This tool is used to identify potential risks in the early stages of a project and is a part of the overall project management plan.
**SWOT Analysis**
The SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats) is a strategic planning tool used to identify and analyze the strengths, weaknesses, opportunities, and threats involved in a project or business. It can be used to identify potential risks (threats) that could negatively affect the business model.
**PESTEL Analysis**
The PESTEL Analysis (Political, Economic, Social, Technological, Environmental, Legal) is a framework or tool used by marketers to analyze and monitor the macro-environmental factors that have an impact on an organization. By understanding these external environments, businesses can maximize the opportunities and minimize the threats to the organization.
**Risk Breakdown Structure (RBS)**
The Risk Breakdown Structure (RBS) is a hierarchical representation of risks according to their risk categories. This tool is used in risk management to help identify and manage potential risks associated with a project or business.
**Failure Mode and Effects Analysis (FMEA)**
Failure Mode and Effects Analysis (FMEA) is a step-by-step approach for identifying all possible failures in a design, a manufacturing or assembly process, or a product or service. It is a common tool for risk assessment and is used to identify potential failure modes, determine their effect on the operation of the product, and identify actions to mitigate the failures.
**Monte Carlo Simulation**
Monte Carlo Simulation is a computerized mathematical technique that allows people to account for risk in quantitative analysis and decision making. It provides a range of possible outcomes and the probabilities they will occur for any choice of action. It shows the extreme possibilities—the outcomes of going for broke and for the most conservative decision—along with all possible consequences for middle-of-the-road decisions.

### Prompts
`Identify the top 5 risks associated with our business model and explain their potential impact.`
`What mitigation strategies can we implement for each identified risk?`
`How likely is each risk to occur, and what triggers should alert us?`
`How would each risk affect our key metrics if realized?`
`What contingency plans should we develop to address worst-case scenarios?`

---

## Suggestions

### Summary
Actionable improvement proposals and strategic recommendations resulting from the strategic analysis.

### Description
Suggestions are concrete improvement proposals identified during the model analysis phase. They target operational bottlenecks, value proposition enhancements, or cost optimizations to increase business model resilience.

## Keys

### Summary
Key success factors, critical capabilities, and core competencies required for business model execution.

### Description
Keys represent the critical capabilities, resources, and operational milestones that determine the success or failure of the venture. They serve as leading indicators of strategic performance.

## Coherence

### Summary
Internal consistency checks evaluating how well business model components reinforce each other.

### Description
Coherence evaluates the structural alignment between value propositions, customer segments, operational activities, and cost/revenue structures, ensuring no contradictory incentives exist.

### Methodologies
*No methodologies provided.*

### Prompts
`Evaluate the coherence between our value proposition, customer segments, and revenue streams.`
`Identify any misalignments among business model components and suggest corrective actions.`
`How does each core activity support our overall strategy?`
`Map interdependencies among resources, activities, and partners to ensure alignment.`
`Propose a framework to maintain model coherence as we evolve.`

---

## Experiments

### Summary
Experiments are tests or trials designed to validate assumptions and hypotheses about a business model's value proposition, customer segments, and revenue streams.

### Description
"Experiment List" in business modeling refers to a systematic list of tests or trials designed to validate the assumptions and hypotheses about a business model's value proposition, customer segments, and revenue streams. This list is used as a roadmap to test and validate the viability and effectiveness of a business model before its full-scale implementation.

An experiment list can include various types of tests depending on the specific aspects of the business model that need validation. For instance, it may include customer interviews to validate assumptions about customer needs and preferences. It may also include prototype testing to validate the feasibility and attractiveness of a product or service offering.

Moreover, an experiment list can also include market tests to validate assumptions about the size and profitability of a market segment. It may also include financial tests to validate assumptions about revenue streams and cost structures.

The experiment list serves as a structured approach to risk management in business design and modeling. It helps business leaders and stakeholders to identify and address potential flaws and weaknesses in a business model before they become costly mistakes. It also provides valuable insights and learnings that can be used to refine and improve the business model.

In conclusion, an experiment list is a critical tool in business design and modeling. It provides a systematic and evidence-based approach to validating the key assumptions and hypotheses of a business model, reducing risks and increasing the chances of success. It is a crucial component of a lean and agile business model, promoting continuous learning and adaptation in response to market feedback and changes.

### Methodologies
**Lean Startup Methodology**
The Lean Startup methodology, developed by Eric Ries, emphasizes the importance of conducting experiments to validate business assumptions. The methodology encourages businesses to create a "Minimum Viable Product" (MVP) and use it to test key business hypotheses. The feedback received from these experiments is then used to iterate and improve the business model.
**Design Thinking**
Design Thinking is a problem-solving approach that involves empathizing with users, defining problems, ideating solutions, prototyping, and testing. The testing phase often involves conducting experiments to validate the solutions developed during the ideation phase. These experiments can provide valuable insights into the value proposition, customer segments, and revenue streams of a business model.
**Business Model Canvas**
The Business Model Canvas, developed by Alexander Osterwalder, includes a component called "channels" which can be used to design and conduct experiments. These experiments can test assumptions about how a company communicates and delivers its value proposition to its customer segments.
**Value Proposition Canvas**
This tool, also developed by Alexander Osterwalder, is designed to help businesses understand their customers' needs and create products and services that meet those needs. It encourages businesses to conduct experiments to validate their assumptions about their value proposition and customer segments.
**Pivot or Persevere**
This is a decision-making process used in the Lean Startup methodology. After conducting experiments, businesses use the results to decide whether to pivot (make a fundamental change to the business model) or persevere (keep improving the current model). This process is crucial for validating a business model's value proposition, customer segments, and revenue streams.
**Growth Hacking**
Growth Hacking is a marketing strategy that focuses on rapid experimentation across marketing channels and product development to identify the most effective ways to grow a business. These experiments can provide valuable insights into a business model's value proposition, customer segments, and revenue streams.

### Prompts
`Design an experiment to test customer interest via a targeted landing page.`
`Propose a pricing experiment to determine the optimal price point.`
`Plan a pilot program to evaluate operational feasibility in a small market.`
`What metrics will measure experiment success, and how will we collect the data?`
`How should we iterate on the experiment based on initial results?`

