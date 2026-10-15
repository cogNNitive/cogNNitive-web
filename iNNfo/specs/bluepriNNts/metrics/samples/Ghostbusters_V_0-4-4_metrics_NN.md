---
level: 3
parent_spec:
  name: "metrics_V_0-4-4"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/metrics/spec_NN.md"
knowledge_version: "V_0-4-4"
title: "Ghostbusters Containment Revenue Projection"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN Metrics

## NN Metrics: Monthly Net Result
slug:: monthly-net-result
metricValue:: <calculated>
metricFormula:: monthly containment revenue - monthly direct costs - monthly operating subtotal
dependsOn:: [[Monthly Containment Revenue]]
metricType:: result
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Monthly bottom line. Year 1 baseline resolves near break-even against the $1.2M revenue base.

## NN Metrics: Monthly Containment Revenue
slug:: monthly-containment-revenue
sources:: [sources/import/containment-incidents-1984.csv@INC-1041, sources/import/containment-incidents-1984.csv@INC-1048]
metricValue:: <calculated>
metricFormula:: monthly incidents x average fee per incident
dependsOn:: [[Monthly Incidents]]
metricType:: revenue
metricUnit:: USD/month
evolution:: [[Compound 5 Evolution]]

Anchored on Year 1 actuals: 240 incidents at $5,000 average fee ($1.2M/year, ~$100,000/month).

## NN Metrics: Monthly Direct Costs
slug:: monthly-direct-costs
metricValue:: <calculated>
metricFormula:: monthly incidents x direct cost per incident
dependsOn:: [[Monthly Incidents]]
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Unit economics: $1,800 direct cost per incident (labor + equipment + fuel), 64% gross margin.

## NN Metrics: Monthly Operating Subtotal
slug:: monthly-operating-subtotal
metricValue:: <calculated>
metricFormula:: monthly payroll + equipment maintenance + facility operations + insurance + Ecto-1 operations
dependsOn:: [[Monthly Payroll]]
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

## NN Metrics: Monthly Payroll
slug:: monthly-payroll
metricValue:: 35000
metricFormula:: <fixed monthly slice of $420,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

4 full-time operators + 1 office manager.

## NN Metrics: Equipment Maintenance
slug:: equipment-maintenance
metricValue:: 7083
metricFormula:: <fixed monthly slice of $85,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Proton Pack calibration, trap refurbishment, PKE meter replacement.

## NN Metrics: Facility Operations
slug:: facility-operations
metricValue:: 10000
metricFormula:: <fixed monthly slice of $120,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Firehouse lease, utilities, containment grid power.

## NN Metrics: Monthly Insurance
slug:: monthly-insurance
metricValue:: 7917
metricFormula:: <fixed monthly slice of $95,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Liability insurance, legal retainers, regulatory compliance.

## NN Metrics: Ecto-1 Operations
slug:: ecto-1-operations
metricValue:: 2083
metricFormula:: <fixed monthly slice of $25,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Additive 5 Evolution]]

Ecto-1 fuel, maintenance, insurance. Grows with mileage.

## NN Metrics: Vault Expansion Capex
slug:: vault-expansion-capex
metricValue:: 25000
metricFormula:: <one-off containment vault expansion>
metricType:: investment
metricUnit:: USD
evolution:: [[Fixed Evolution]]

# NN Variables

## NN Variables: Monthly Incidents
slug:: monthly-incidents
variableValue:: 20
variableType:: count
variableUnit:: incidents

Year 1 pace: 240 incidents resolved.

## NN Variables: Average Fee Per Incident
slug:: average-fee-per-incident
variableValue:: 5000
variableType:: fee
variableUnit:: USD/incident

Blended residential call-out average.

## NN Variables: Direct Cost Per Incident
slug:: direct-cost-per-incident
variableValue:: 1800
variableType:: cost
variableUnit:: USD/incident

Labor + equipment + fuel per incident.

## NN Variables: Monthly Growth Pct
slug:: monthly-growth-pct
variableValue:: 5
variableType:: growth
variableUnit:: "%"

Compounding driver toward the $2.8M Year 2 projection.

# NN Evolution

## NN Evolution: Fixed Evolution
slug:: fixed-evolution
evolutionType:: fixed
evolutionFactor:: 0

## NN Evolution: Compound 5 Evolution
slug:: compound-5-evolution
evolutionType:: compound
evolutionFactor:: 5

## NN Evolution: Additive 5 Evolution
slug:: additive-5-evolution
evolutionType:: additive
evolutionFactor:: 5

# NN Scenario

## NN Scenario: Year 1 Baseline
slug:: year-1-baseline
scenarioMonths:: 12
scenarioNotes:: Actuals: $1.2M revenue on 240 incidents. Near break-even after direct costs and overhead.

## NN Scenario: Regional Expansion
slug:: regional-expansion
scenarioMonths:: 36
scenarioNotes:: NYC coverage plus 3-city expansion driving toward $2.8M Year 2 and $5.5M Year 3.

# NN matrices: metrics-dependencies matrix
| Metrics \ Metrics | Monthly Net Result | Monthly Containment Revenue | Monthly Direct Costs | Monthly Operating Subtotal |
| :--- | :---: | :---: | :---: | :---: |
| Monthly Containment Revenue | DependsOn | - | - | - |
| Monthly Direct Costs | DependsOn | - | - | - |
| Monthly Operating Subtotal | DependsOn | - | - | - |
| Monthly Payroll | - | - | - | DependsOn |
| Equipment Maintenance | - | - | - | DependsOn |
| Facility Operations | - | - | - | DependsOn |
| Monthly Insurance | - | - | - | DependsOn |
| Ecto-1 Operations | - | - | - | DependsOn |

# NN matrices: metric-variables matrix
| Metrics \ Variables | Monthly Incidents | Average Fee Per Incident | Direct Cost Per Incident | Monthly Growth Pct |
| :--- | :---: | :---: | :---: | :---: |
| Monthly Containment Revenue | Uses | Uses | - | - |
| Monthly Direct Costs | Uses | - | Uses | - |

# NN matrices: scenario-metrics matrix
| Scenario \ Metrics | Monthly Net Result | Monthly Containment Revenue | Vault Expansion Capex |
| :--- | :---: | :---: | :---: |
| Year 1 Baseline | Includes | Includes | - |
| Regional Expansion | Includes | Includes | Includes |

# NN matrices: item-markers matrix
| Item \ Marker | is_variable | is_formula | is_derived |
| :--- | :---: | :---: | :---: |
| Monthly Incidents | X | - | - |
| Average Fee Per Incident | X | - | - |
| Direct Cost Per Incident | X | - | - |
| Monthly Growth Pct | X | - | - |
| Monthly Payroll | X | - | - |
| Equipment Maintenance | X | - | - |
| Facility Operations | X | - | - |
| Monthly Insurance | X | - | - |
| Ecto-1 Operations | X | - | - |
| Vault Expansion Capex | X | - | - |
| Monthly Net Result | - | X | - |
| Monthly Containment Revenue | - | X | - |
| Monthly Direct Costs | - | X | - |
| Monthly Operating Subtotal | - | X | - |
