# Skill Locations — Canonical Reference

Single source of truth for where cogNNitive skills and MCP bundles live. `nn-skills-lifecycle` MUST reference
this file and MUST NOT hardcode paths.

## Canonical Install Locations

| Location | Purpose |
|---|---|
| `~/.agents/skills/{name}/` | Installed skills (user-level), managed by `scripts/skills-manager.js` — manifest-pinned tarball `install`/`update`, or a plain `sync` copy |
| `~/.config/opencode/skills/{name}/` | opencode user skills (global) |
| `.opencode/skills/` | opencode project skills (repo-scoped) |
| `.cogNNitive/mcp-bundle.js` (repo root) | Downloaded `innfo-mcp` bundle, written by `scripts/update-mcp.js` (see `openspec/specs/mcp-bridge`) |

`scripts/skills-manager.js` installs and updates by downloading a commit-pinned
GitHub tarball (`https://codeload.github.com/{repo}/tar.gz/{commit}`) and
copying the pinned path into place — never a link. Its `sync` command likewise
copies (not links) between this repo's `skills/` and a target `--skills-dir`.
See `nn-skills-lifecycle/SKILL.md` for the full command reference.

## Manual live-linking (optional — not automated by any script)

Nothing in `scripts/skills-manager.js` or `nn-skills-lifecycle` creates a
Junction or SymbolicLink. A maintainer who wants a repo-local skill folder to
reflect edits live in `~/.agents/skills/{name}/`, instead of re-running `sync`
after every change, can link it by hand with the commands below. This is a
separate, manual concern from the automated manifest-based install/update.

### Detection — LinkType

To detect whether a path is a Junction, a SymbolicLink, or a regular directory, use
`Get-Item` and inspect `.LinkType`:

```powershell
$item = Get-Item -LiteralPath <path>
if ($null -eq $item.LinkType) { "Regular directory" }
elseif ($item.LinkType -eq "Junction") { "Junction" }
elseif ($item.LinkType -eq "SymbolicLink") { "SymbolicLink -> $($item.Target)" }
else { "Link type: $($item.LinkType)" }
```

`LinkType` is `Junction`, `SymbolicLink`, or empty (`$null`) for a regular directory.

### Creation — Junction

```powershell
New-Item -ItemType Junction -Path <link> -Target <target>
```

Junctions work for directories and require no administrator privileges on Windows.

### Creation — SymbolicLink

```powershell
New-Item -ItemType SymbolicLink -Path <link> -Target <target>
```

Symbolic links to directories require an elevated (administrator) shell on Windows,
or Developer Mode enabled. On macOS/Linux they work without elevation. Prefer
Junctions for directory links on Windows.

## Usage Note

The commands above are a manual reference only — no automated flow in this repo
calls them. `nn-skills-lifecycle`'s install/update/sync is manifest- and
tarball-driven, documented in its own `SKILL.md`; it does not read this file to
create links. Path or location conventions still belong here, not hardcoded
into consuming skills — any change is made here once.
