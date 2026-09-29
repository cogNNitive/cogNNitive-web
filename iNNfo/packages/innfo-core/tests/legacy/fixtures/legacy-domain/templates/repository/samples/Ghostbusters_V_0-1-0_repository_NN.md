---
level: 3
parent_spec:
  name: "repository_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/repository/spec_NN.md"
model_version: "V_0-1-0"
title: "Ghostbusters Inc. Firmware & Telemetry Repository Model"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Repository

## NN Repository: ghostbusters-core
name:: ghostbusters/ectoplasm-telemetry
remote_url:: https://github.com/ghostbusters/ectoplasm-telemetry
description:: Central telemetry firmware and laser containment grid control daemon.

# NN State

## NN State: Production Operational
status:: active
default_branch:: main
visibility:: private
Primary operational release line running continuously on Tribeca headquarters laser grid and Ecto-1 dispatch terminals.

# NN Releases

## NN Releases: Release v2.4.0
version:: v2.4.0
released_at:: 2026-09-01T12:00:00Z
notes:: High-voltage grid laser stabilization and PKE sensor auto-calibration firmware.

# NN Changes

## NN Changes: Patch Particle Valve Controller
summary:: Calibrate thrower stream decay rate and reduce heat dissipation by 18%.
author:: Egon Spengler
hash:: 8f4e2a1
Critical particle valve governor update preventing thermal pack runaway during prolonged entity tethering.

## NN Changes: Add Containment Telemetry Socket
summary:: Stream real-time vault pressure telemetry to Ecto-1 mobile radio unit.
author:: Ray Stantz
hash:: 3b9c7d2
Enables mobile response teams to monitor headquarters grid stability while engaged in field operations across Manhattan.

# NN matrices: change release relations
| Changes \ Releases | Release v2.4.0 |
| :--- | :---: |
| Patch Particle Valve Controller | Included |
| Add Containment Telemetry Socket | Included |

# NN matrices: state release relations
| Releases \ State | Production Operational |
| :--- | :---: |
| Release v2.4.0 | Active |
