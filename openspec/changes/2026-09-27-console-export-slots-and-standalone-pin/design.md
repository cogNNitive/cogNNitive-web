# Design: Console Export JSON Slot Escaping and Standalone CDN Pinning

## Architecture Overview

`scripts/export-console.mjs` is the standalone tool that compiles Level 3 iNNfo models into self-contained single-file offline HTML consoles.

### 1. Functional Slot Injection

Previous string replacement:
```javascript
const slot = (id, json) =>
  blueprint.replace(
    new RegExp(`(<script type="application/json" id="${id}">)[\\s\\S]*?(</script>)`),
    `$1\n${JSON.stringify(json, null, 2)}\n$2`,
  )
```

Target functional replacement with accumulator chaining:
```javascript
function injectSlots(blueprint, config, schema, model) {
  const slot = (target, id, json) =>
    target.replace(
      new RegExp(`(<script type="application/json" id="${id}">)[\\s\\S]*?(</script>)`),
      (_match, open, close) => `${open}\n${JSON.stringify(json, null, 2)}\n${close}`,
    )
  let out = blueprint
  out = slot(out, 'innfo-config', config)
  out = slot(out, 'innfo-schema', schema)
  out = slot(out, 'innfo-model', model)
  return out
}
```

### 2. Standalone Pin Derivation

Rather than importing repo-root dependencies:
- Inspect vendored `innfo-console.bundle.js` for version comments (`/* @cognnitive/innfo-console vX.Y.Z */`).
- Default safely to fallback stable tag if banner is absent.
- Execute standalone next to console assets or inside any workspace.
