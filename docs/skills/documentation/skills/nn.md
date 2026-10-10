---
title: "nn — Front Controller & Job Loop Router"
description: "Primary Front Controller, ecosystem entry point, job loop navigation menu, system governance, and preflight readiness gate."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn Front Controller

**Skill**: `nn` · **Role**: Primary Front Controller & Job Loop Menu

Primary interactive entry point and front controller for system governance, setup, environment readiness checks, and job loop navigation across the **cogNNitive** ecosystem.

---

## 0. Activation Contract

Activates whenever the user invokes `/nn`, `/start`, or begins a session in a cogNNitive domain workspace.

---

## 1. Environment Readiness (Domain State Probe Gate)

Before running specialized workflows, `nn` executes the fast local domain probe as sole gate owner:
```bash
node skills/nn-preflight/scripts/domain-probe.js --workspace-dir . --json
```

1. **Layout**: Identifies layout (`current`, `legacy`, `mixed`).
2. **Preflight**: Verifies Node.js runtime, MCP tools, and workspace integrity.
3. **Domain State Counts**: Inspects pending sources in `sources/import/`, active models in `kNNowledge/`, and available procedures.

---

## 2. Job Loop Navigation Menu

Organizes workspace operations into a continuous loop:
- `[s] Sources` — Ingest, scan, normalize, or refresh sources
- `[m] Model` — Create, author, validate, or audit kNNowledge models
- `[r] Review & Deliverables` — Generate/preview dashboards, sites, consoles, reports
- `[p] Procedures` — Discover and execute domain & blueprint SOP procedures
- `[h] Help & Documentation` — Explore blueprints catalog, specs, guides
- `[x] Cancel / Exit`
