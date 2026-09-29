---
level: 3
parent_spec:
  name: "documentation_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/documentation/spec_NN.md"
model_version: "V_0-2-0"
title: "Ghostbusters Inc. Field Operations Handbook"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[DocSite]]
* [[Section]]
* [[Page]]
* [[NavbarItem]]
* [[Asset]]

# NN DocSite

## NN DocSite: Field Operations Handbook
site_title:: Ghostbusters Inc. Field Operations Handbook
site_description:: Canonical field manual for paranormal investigation, entity capture, and containment-grid operations run out of the firehouse headquarters.
base_path:: handbook/
site_logo:: assets/no-ghost-logo.svg
repo_url:: https://github.com/ghostbusters/operations
nav_enabled:: true

# NN Section

## NN Section: Equipment
section_order:: 1
parent:: [[Field Operations Handbook]]

## NN Section: Procedures
section_order:: 2
parent:: [[Field Operations Handbook]]

## NN Section: Personnel
section_order:: 3
parent:: [[Field Operations Handbook]]

# NN Page

## NN Page: Handbook Overview
title:: Handbook Overview
source:: overview.md
route:: overview
order:: 10
parent:: [[Field Operations Handbook]]
tags:: [docs, handbook, onboarding]

Purpose of the handbook, how it is organized, and who must read it before riding out in the Ecto-1.

## NN Page: Proton Pack
title:: Proton Pack
source:: equipment/proton-pack.md
route:: equipment/proton-pack
order:: 10
parent:: [[Equipment]]
tags:: [docs, equipment, particle-accelerator, safety]

Startup sequence, power-cell limits, and safety interlocks for the unlicensed nuclear accelerator worn on every field call.

## NN Page: Ghost Trap
title:: Ghost Trap
source:: equipment/ghost-trap.md
route:: equipment/ghost-trap
order:: 20
parent:: [[Equipment]]
tags:: [docs, equipment, containment, battery]

Deployment, foot-pedal triggering, containment seal checks, and transfer protocols back to the basement grid.

## NN Page: PKE Meter
title:: PKE Meter
source:: equipment/pke-meter.md
route:: equipment/pke-meter
order:: 30
parent:: [[Equipment]]
tags:: [docs, equipment, sensor, psychokinetic]

Reading psychokinetic-energy frequency spikes, tracking entity residual trails, and calibrating the wings before entering hot zones.

## NN Page: Entrapment Protocol
title:: Entrapment Protocol
source:: procedures/entrapment.md
route:: procedures/entrapment
order:: 10
parent:: [[Procedures]]
tags:: [docs, procedure, field-capture, cross-streams]

Step-by-step field protocol for coordinating dual proton streams into the trap cone without crossing streams.

## NN Page: Grid Transfer
title:: Grid Transfer
source:: procedures/grid-transfer.md
route:: procedures/grid-transfer
order:: 20
parent:: [[Procedures]]
tags:: [docs, procedure, basement, containment-grid]

Procedure for inserting full traps into the basement containment grid and safely venting residual psychomagnotheric charge.

## NN Page: Roster
title:: Roster
source:: personnel/roster.md
route:: personnel/roster
order:: 10
parent:: [[Personnel]]
tags:: [docs, personnel, team, contacts]

Authorized field investigators, scientific leads, and emergency contact frequencies for the firehouse watch desk.

# NN NavbarItem

## NN NavbarItem: Handbook Home
label:: 📘 Manual
url:: /
order:: 1
parent:: [[Field Operations Handbook]]

## NN NavbarItem: Equipment Guide
label:: ⚡ Equipment
url:: #/equipment/proton-pack
order:: 2
parent:: [[Field Operations Handbook]]

## NN NavbarItem: Containment Grid
label:: 🔋 Grid Status
url:: https://grid.ghostbusters.com
order:: 3
parent:: [[Field Operations Handbook]]

# NN Asset

## NN Asset: No-Ghost Logo
asset_path:: assets/no-ghost-logo.svg
type:: image

## NN Asset: Proton Pack Schematic
asset_path:: assets/proton-pack-schematic.png
type:: diagram

## NN Asset: Field Call Incident Log Sheet
asset_path:: assets/incident-log-form.pdf
type:: file
