# MCP Setup — innfo-mcp

> Investigated: 2026-07-12

## What is this

innfo-mcp is an MCP server that provides semantic iNNfo tools (validate, list, read, apply changes). It's built as a single-file ESM bundle and served from `docs/cdn/` via GitHub Pages at `https://cognnitive.com/innfo/cdn/`.

## Recommended: automated bootstrap

Don't hand-edit the config files below unless you have to. `scripts/skills-manager.js`
already detects your installed editor (OpenCode, Claude Code, Antigravity) and writes
its MCP config for you, alongside skills and templates, in one step:

```bash
node scripts/skills-manager.js bootstrap --agent auto
```

Pass `--agent <opencode|claude|antigravity>` to target a specific editor, or `--agent all`
to register every supported one. See `node scripts/skills-manager.js bootstrap --help`
for the full flag list (scope, custom directories, non-interactive `--yes`).

If your editor isn't one of the three above, or you need to see exactly what the
automated step writes, use the manual setup below instead.

## Manual setup (fallback / unsupported editor)

No need to clone the repo. Use the bootstrap script, which downloads and caches the bundle automatically.

### 1. Install the bootstrap script

Pick your platform and create the file:

**Windows** — copy `scripts/innfo-mcp.cmd` and `scripts/innfo-mcp.ps1` to a location in your PATH (or use the script below as `%USERPROFILE%\.cache\innfo-mcp\innfo-mcp.cmd`):

```batch
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0innfo-mcp.ps1" %*
```

The `.ps1` script handles all the logic (download, cache, version check):

**macOS / Linux** — save as `~/.cache/innfo-mcp/bootstrap.sh` and `chmod +x`:

```sh
#!/bin/sh
set -e

CACHE_DIR="${HOME}/.cache/innfo-mcp"
VERSION_FILE="${CACHE_DIR}/current-version.txt"
BUNDLE_FILE="${CACHE_DIR}/innfo-mcp.bundle.js"
MANIFEST_URL="https://cognnitive.com/innfo/cdn/manifest.json"

mkdir -p "${CACHE_DIR}"

LATEST=""
if command -v curl >/dev/null 2>&1; then
    LATEST=$(curl -sL --connect-timeout 3 "${MANIFEST_URL}" 2>/dev/null | sed 's/.*"latest"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' 2>/dev/null || echo "")
elif command -v wget >/dev/null 2>&1; then
    LATEST=$(wget -q -O - --timeout=3 "${MANIFEST_URL}" 2>/dev/null | sed 's/.*"latest"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' 2>/dev/null || echo "")
fi

if [ -n "${LATEST}" ]; then
    CACHED=""
    if [ -f "${VERSION_FILE}" ]; then
        CACHED=$(cat "${VERSION_FILE}")
    fi
    if [ "${LATEST}" != "${CACHED}" ]; then
        echo "Downloading innfo-mcp ${LATEST}..."
        BUNDLE_URL="https://cognnitive.com/innfo/cdn/innfo-mcp-${LATEST}.bundle.js"
        if command -v curl >/dev/null 2>&1; then
            curl -sL "${BUNDLE_URL}" -o "${BUNDLE_FILE}"
        elif command -v wget >/dev/null 2>&1; then
            wget -q "${BUNDLE_URL}" -O "${BUNDLE_FILE}"
        fi
        echo "${LATEST}" > "${VERSION_FILE}"
        echo "Done."
    fi
elif [ ! -f "${BUNDLE_FILE}" ]; then
    echo "ERROR: No internet and no cached bundle. Run with internet first."
    exit 1
fi

exec node "${BUNDLE_FILE}" "$@"
```

The bootstrap checks `manifest.json` on the CDN every time it runs. If a newer version exists, it downloads and caches it automatically. No manual update steps needed.

### 2. Configure your agent

Point your AI client to the bootstrap script.

#### OpenCode (Windows)

`~/.config/opencode/opencode.json` or `.opencode/opencode.json`:

```json
{
  "mcp": {
    "innfo-mcp": {
      "type": "local",
      "command": ["C:\\Users\\<you>\\.cache\\innfo-mcp\\innfo-mcp.cmd"],
      "enabled": true
    }
  }
}
```

Or point directly to the script in this repo (if cloned):

```json
{
  "mcp": {
    "innfo-mcp": {
      "type": "local",
      "command": ["node", "packages/innfo-mcp/bin/innfo-mcp.bundle.js"],
      "enabled": true
    }
  }
}
```

#### OpenCode (macOS / Linux)

```json
{
  "mcp": {
    "innfo-mcp": {
      "type": "local",
      "command": ["/home/<you>/.cache/innfo-mcp/bootstrap.sh"],
      "enabled": true
    }
  }
}
```

#### Antigravity

`.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "innfo-mcp": {
      "command": "/home/<you>/.cache/innfo-mcp/bootstrap.sh"
    }
  }
}
```

#### Claude Code

`.claude/settings.json`:

```json
{
  "mcpServers": {
    "innfo-mcp": {
      "command": "/home/<you>/.cache/innfo-mcp/bootstrap.sh"
    }
  }
}
```

## Clone-based setup (alternative)

If you already have the repo cloned:

```bash
cd packages/innfo-mcp
npm install && npm run build
```

Then point your agent to `packages/innfo-mcp/dist/server.js` directly (see version below).

## Shared config format (clone-based)

All clients use the same JSON structure:

```json
{
  "mcpServers": {
    "innfo-mcp": {
      "command": "node",
      "args": ["path/to/iNNfo/packages/innfo-mcp/dist/server.js"]
    }
  }
}
```

### OpenCode (clone-based)

```json
{
  "mcp": {
    "innfo-mcp": {
      "type": "local",
      "command": ["node", "packages/innfo-mcp/dist/server.js"],
      "enabled": true
    }
  }
}
```

### Antigravity (clone-based)

`.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "innfo-mcp": {
      "command": "node",
      "args": ["packages/innfo-mcp/dist/server.js"]
    }
  }
}
```

### Claude Code (clone-based)

`.claude/settings.json`:

```json
{
  "mcpServers": {
    "innfo-mcp": {
      "command": "node",
      "args": ["packages/innfo-mcp/dist/server.js"]
    }
  }
}
```

## Pre-flight check

Before editing a model, the agent should verify MCP is available:

1. Check if innfo-mcp tools are listed in the current session's tool list
2. If not, check the config files above exist
3. If configured but not loading → the client may need a reload
4. If not configured → create the workspace-level config file, then ask the user to reload

## Updating the bundle

The bundle is built from `packages/innfo-mcp/src/server.ts` and staged to `docs/innfo/cdn/`
for CDN serving by the docs build (the same command CI runs):

```bash
npm run build:docs
```

This builds the bundle and copies it to
`docs/innfo/cdn/innfo-mcp-<version>.bundle.js`, updating `docs/innfo/cdn/manifest.json`.

## Related

- `packages/innfo-mcp/` — server source code
- `docs/cdn/innfo-mcp-v0.2.4.bundle.js` — current published bundle
- `scripts/innfo-mcp.cmd` — Windows bootstrap script (in repo)
- `scripts/innfo-mcp.sh` — Unix bootstrap script (in repo)
