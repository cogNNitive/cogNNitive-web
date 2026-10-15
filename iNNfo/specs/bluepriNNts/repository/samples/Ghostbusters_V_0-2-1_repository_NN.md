---
level: 3
parent_spec:
  name: "repository_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/repository/spec_NN.md"
knowledge_version: "V_0-2-1"
title: "Ghostbusters Inc. Firmware & Telemetry Repository Model"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN Repository

## NN Repository: ghostbusters-core
slug:: ghostbusters-core
name:: ghostbusters/ectoplasm-telemetry
remote_url:: https://github.com/ghostbusters/ectoplasm-telemetry
description:: Central telemetry firmware and laser containment grid control daemon.

# NN State

## NN State: Production Operational
slug:: production-operational
status:: active
default_branch:: main
visibility:: private
Primary operational release line running continuously on Tribeca headquarters laser grid and Ecto-1 dispatch terminals.

# NN Releases

## NN Releases: Release v2.4.0
slug:: release-v240
version:: v2.4.0
released_at:: 2026-09-01T12:00:00Z
notes:: High-voltage grid laser stabilization and PKE sensor auto-calibration firmware.

# NN Changes

## NN Changes: Patch Particle Valve Controller
slug:: patch-particle-valve-controller
summary:: Calibrate thrower stream decay rate and reduce heat dissipation by 18%.
author:: Egon Spengler
hash:: 8f4e2a1
Critical particle valve governor update preventing thermal pack runaway during prolonged entity tethering.

## NN Changes: Add Containment Telemetry Socket
slug:: add-containment-telemetry-socket
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
