---
level: 3
parent_spec:
  name: "metrics_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
model_version: "V_0-2-1"
title: "Ghostbusters Containment Revenue Projection"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Metrics

## NN Metrics: Monthly Net Result
metricValue:: <calculated>
metricFormula:: monthly containment revenue - monthly direct costs - monthly operating subtotal
dependsOn:: [[Monthly Containment Revenue]]
metricType:: result
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Monthly bottom line. Year 1 baseline resolves near break-even against the $1.2M revenue base.

## NN Metrics: Monthly Containment Revenue
sources:: [sources/nn/containment-incidents-1984.csv@INC-1041, sources/nn/containment-incidents-1984.csv@INC-1048]
metricValue:: <calculated>
metricFormula:: monthly incidents x average fee per incident
dependsOn:: [[Monthly Incidents]]
metricType:: revenue
metricUnit:: USD/month
evolution:: [[Compound 5 Evolution]]

Anchored on Year 1 actuals: 240 incidents at $5,000 average fee ($1.2M/year, ~$100,000/month).

## NN Metrics: Monthly Direct Costs
metricValue:: <calculated>
metricFormula:: monthly incidents x direct cost per incident
dependsOn:: [[Monthly Incidents]]
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Unit economics: $1,800 direct cost per incident (labor + equipment + fuel), 64% gross margin.

## NN Metrics: Monthly Operating Subtotal
metricValue:: <calculated>
metricFormula:: monthly payroll + equipment maintenance + facility operations + insurance + Ecto-1 operations
dependsOn:: [[Monthly Payroll]]
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

## NN Metrics: Monthly Payroll
metricValue:: 35000
metricFormula:: <fixed monthly slice of $420,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

4 full-time operators + 1 office manager.

## NN Metrics: Equipment Maintenance
metricValue:: 7083
metricFormula:: <fixed monthly slice of $85,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Proton Pack calibration, trap refurbishment, PKE meter replacement.

## NN Metrics: Facility Operations
metricValue:: 10000
metricFormula:: <fixed monthly slice of $120,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Firehouse lease, utilities, containment grid power.

## NN Metrics: Monthly Insurance
metricValue:: 7917
metricFormula:: <fixed monthly slice of $95,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Fixed Evolution]]

Liability insurance, legal retainers, regulatory compliance.

## NN Metrics: Ecto-1 Operations
metricValue:: 2083
metricFormula:: <fixed monthly slice of $25,000/year>
metricType:: expense
metricUnit:: USD/month
evolution:: [[Additive 5 Evolution]]

Ecto-1 fuel, maintenance, insurance. Grows with mileage.

## NN Metrics: Vault Expansion Capex
metricValue:: 25000
metricFormula:: <one-off containment vault expansion>
metricType:: investment
metricUnit:: USD
evolution:: [[Fixed Evolution]]

# NN Variables

## NN Variables: Monthly Incidents
variableValue:: 20
variableType:: count
variableUnit:: incidents

Year 1 pace: 240 incidents resolved.

## NN Variables: Average Fee Per Incident
variableValue:: 5000
variableType:: fee
variableUnit:: USD/incident

Blended residential call-out average.

## NN Variables: Direct Cost Per Incident
variableValue:: 1800
variableType:: cost
variableUnit:: USD/incident

Labor + equipment + fuel per incident.

## NN Variables: Monthly Growth Pct
variableValue:: 5
variableType:: growth
variableUnit:: "%"

Compounding driver toward the $2.8M Year 2 projection.

# NN Evolution

## NN Evolution: Fixed Evolution
evolutionType:: fixed
evolutionFactor:: 0

## NN Evolution: Compound 5 Evolution
evolutionType:: compound
evolutionFactor:: 5

## NN Evolution: Additive 5 Evolution
evolutionType:: additive
evolutionFactor:: 5

# NN Scenario

## NN Scenario: Year 1 Baseline
scenarioMonths:: 12
scenarioNotes:: Actuals: $1.2M revenue on 240 incidents. Near break-even after direct costs and overhead.

## NN Scenario: Regional Expansion
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
