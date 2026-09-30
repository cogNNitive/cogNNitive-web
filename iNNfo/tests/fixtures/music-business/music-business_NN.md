---
spec_version: "V_0-1-3"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/v0.1.2/specs/FORMAT_V_0-1-3_FORMAT.md"
level: 3
parent:
  name: "business_V_0-1-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/v0.1.1/specs/business_V_0-1-1_NN.md"
knowledge_version: "V_0-0-1"
title: "Vinyl Records Inc."
---

> [!NOTE]
> This is a **FORMAT document** — business model for an independent record label using FILE mode.

# _F index

* _F index: Business summary
* _F index: Problems
* _F index: Value propositions
* _F index: Channels
* _F index: Stakeholders

# _F Business summary

Vinyl Records Inc. is an independent record label founded in 2015, specializing in high-quality vinyl reissues of classic jazz and rock albums. We bridge the gap between legacy catalog owners and audiophile collectors through premium packaging, mastered-from-original-tapes production, and curated direct-to-fan distribution.

# _F Problems

* _F Problems: Streaming revenue decline
  ```yaml
  severity: high
  impact: revenue
  owner: commercial
  ```
  Streaming platforms pay fractions of a cent per play, making it unsustainable for back-catalog owners to rely solely on digital revenue.

* _F Problems: Manufacturing costs
  ```yaml
  severity: medium
  impact: margin
  owner: operations
  ```
  Vinyl pressing costs have risen 40% since 2020 due to supply chain constraints and increased demand for raw materials.

* _F Problems: Discovery challenges
  ```yaml
  severity: medium
  impact: growth
  owner: marketing
  ```
  Independent labels struggle to reach new audiences in a market dominated by major-label marketing budgets and algorithmic playlists.

# _F Value propositions

* _F Value propositions: Audiophile quality
  ```yaml
  effort: high
  impact: high
  owner: production
  ```
  Mastered from original analog tapes, pressed on 180g virgin vinyl, with premium sleeve packaging and liner notes.

* _F Value propositions: Curated catalog
  ```yaml
  effort: medium
  impact: high
  owner: curation
  ```
  Expertly curated reissues spanning jazz, soul, rock, and electronic — each release contextualized with historical essays.

* _F Value propositions: Direct-to-fan
  ```yaml
  effort: low
  impact: medium
  owner: commercial
  ```
  Limited-edition direct-to-consumer drops with signed artwork, exclusive variants, and membership perks.

# _F Channels

* _F Channels: Record stores
  ```yaml
  type: retail
  reach: medium
  cost: high
  ```
  Partnered with 120 independent record stores across North America and Europe.

* _F Channels: Direct e-commerce
  ```yaml
  type: online
  reach: global
  cost: low
  ```
  Shopify store with subscription model, early access for members, and bundle deals.

# _F Stakeholders

* _F Stakeholders: Artists
  ```yaml
  interest: high
  influence: high
  ```
  Legacy artists and estate holders whose catalogs we license and reissue.

* _F Stakeholders: Distributors
  ```yaml
  interest: medium
  influence: high
  ```
  Wholesale partners who stock our releases in retail channels.

* _F Stakeholders: Collectors
  ```yaml
  interest: high
  influence: medium
  ```
  Audiophile community and vinyl collectors who drive demand for premium reissues.

# _F matrices: problems-value propositions matrix

| Problems \ Value propositions | Audiophile quality | Curated catalog | Direct-to-fan |
| :--- | :---: | :---: | :---: |
| Streaming revenue decline | Neutral | Neutral | Max |
| Manufacturing costs | High | Medium | Neutral |
| Discovery challenges | Medium | High | High |
