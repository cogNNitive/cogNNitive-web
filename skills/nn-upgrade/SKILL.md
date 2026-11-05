---
name: nn-upgrade
description: DEPRECATED alias of nn-update. Use nn-update; this skill only forwards to it and logs a deprecation notice. Triggers: none of its own (nn-update owns every trigger).
version: "V_0-1-0"
last_updated: 2026-11-04
metadata:
  source_type: original
license: MIT
compatibility: opencode, claude-code, cursor, any agent supporting skills
bundled_blueprints: []
---

# nn-upgrade (deprecated)

## Notice

`nn-upgrade` is retired. The canonical skill is **`nn-update`**, which owns the
consent-gated Blueprint Lineage Reconciliation flow, the `--freeze-slugs`
maintenance command and the new-domain pointer.

## What to do

1. Tell the user that `nn-update` is the canonical name and that this skill only forwards.
2. Load `nn-update` and follow it exactly. Do not implement any flow here.
3. Do not document `Flow B`, `upgrade-available` or any Tier-3 "upgrade scan" wording:
   those terms are retired. The current vocabulary is **update**,
   **Blueprint Lineage Reconciliation** and **Lineage Audit**.

This file exists only so an old invocation still resolves. It carries no scripts.
