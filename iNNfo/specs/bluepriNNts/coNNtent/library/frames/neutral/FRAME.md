---
name: neutral
description: The blueprint default frame.
colors:
  primary: "#7c3aed"
  background: "#0f0f13"
  foreground: "#111111"
typography:
  heading: { fontFamily: "Inter" }
  body: { fontFamily: "Inter" }
---

# Neutral frame

The blueprint's default frame (`frame:: neutral`). It declares only the engine's
built-in accent and a neutral typeface, so a fresh install renders with the same
palette and no implicit brand — a domain or series adopts a brand frame by
shipping `library/frames/<name>/FRAME.md` and setting `frame:: <name>`.