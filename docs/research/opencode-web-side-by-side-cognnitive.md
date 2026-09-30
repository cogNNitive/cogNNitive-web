# OpenCode Web + Cognnitive Web App Side-by-Side: Feasibility Research

Researched 2026-09-26. OpenCode version referenced: latest GitHub release `v1.18.32` (2026-09-21) ([Releases](https://github.com/sst/opencode/releases)); docs referenced are the live pages at opencode.ai, undated but current as of this research.

## Verdict

OpenCode does **not** have a hosted/cloud web version today. "OpenCode Web" is a local web UI: running `opencode web` starts a server process on your own machine (bound to `127.0.0.1` by default) and opens a browser tab that talks to that local server ([opencode.ai/docs/web/](https://opencode.ai/docs/web/)). It still requires installing the OpenCode CLI locally first — via curl, npm, Homebrew, etc. — and configuring provider/API-key auth exactly as the terminal/desktop flow does ([opencode.ai/docs/](https://opencode.ai/docs/)). So "web" changes the *front end* (browser tab instead of terminal or desktop window), not the installation burden: there is no zero-install, visit-a-URL option from the official project.

Given that, the proposed workflow — OpenCode Web and the Cognnitive Web App (the `innfo-editor` Vite dev server) side by side in two Chrome windows — is technically achievable (both are just `http://localhost:<port>` pages) but is **not** a low-friction, install-free setup for a non-technical user. The person still has to install a CLI tool, run a command in a terminal to start the OpenCode server, obtain and register an LLM provider API key, and separately keep the editor's own dev server running — all before ever opening the two browser windows. This does not remove the terminal/CLI/API-key friction the question was trying to avoid; it only changes what OpenCode looks like once it's already running.

## How OpenCode Web Works (Architecture)

- Client-server, not hosted: "OpenCode can run as a web application in your browser, providing the same powerful AI coding experience without needing a terminal." The command `opencode web` "starts a local server on 127.0.0.1 with a random available port and automatically opens OpenCode in your default browser." ([opencode.ai/docs/web/](https://opencode.ai/docs/web/))
- The agent itself executes locally, on the same machine as the server process — there is no remote/cloud execution in this flow.
- Default binding is localhost-only. To reach it from another device on the same network: `opencode web --hostname 0.0.0.0` ([opencode.ai/docs/web/](https://opencode.ai/docs/web/)).
- Optional password protection for the web UI via `OPENCODE_SERVER_PASSWORD` (default username `opencode`, overridable via `OPENCODE_SERVER_USERNAME`), and mDNS advertising the server as `opencode.local` for LAN discovery ([opencode.ai/docs/web/](https://opencode.ai/docs/web/)).
- The docs page does not describe cross-device session sync, a hosted account system, or phone/tunnel access (e.g. ngrok) — none of that is documented as part of "OpenCode Web."
- Separate from this: OpenCode also ships a **Desktop app** (beta, Electron-style, macOS/Windows/Linux) downloadable from opencode.ai/download or GitHub Releases ([github.com/sst/opencode](https://github.com/sst/opencode)). This is a distinct distribution from the browser-based `opencode web` mode, though both wrap the same local-agent model.
- A search for a genuinely hosted OpenCode cloud offering turned up nothing official. "opencode.cloud" is an unrelated Java framework project with no affiliation to opencode.ai/sst — a false-positive from search, confirmed by fetching the site directly. Third-party services exist that host OpenCode workspaces in managed sandboxes (e.g. cliopen.com), but these are not the official OpenCode product and were excluded per the research standard of prioritizing primary sources.

## Installation Impact (What Changes vs Today)

Today's documented flow in this repo (`docs/innfo/documentation/installing-ai-agents.md`) already recommends OpenCode Desktop/CLI: download the desktop installer or install the CLI (`brew install opencode` / `winget install opencode` / `npm install -g opencode-ai`), then run `opencode .` in the workspace folder.

Using `opencode web` instead requires all the same prerequisites plus one more step:
1. Install the OpenCode CLI (same as today — curl/npm/brew/etc.) ([opencode.ai/docs/](https://opencode.ai/docs/)).
2. Authenticate a provider — `/connect` or the OpenCode Zen curated model list, needing an API key ([opencode.ai/docs/](https://opencode.ai/docs/)). This is identical to CLI/desktop today.
3. Open a terminal and run `opencode web` in the project directory to start the local server ([opencode.ai/docs/web/](https://opencode.ai/docs/web/)) — i.e., a terminal step is still required to *launch* the web UI, even though interaction afterward happens in the browser.
4. A browser tab opens automatically pointing at the local server's random port.

Net effect: **the install and auth burden is unchanged**; the only difference is that after startup, the user interacts through a browser tab instead of a terminal UI or desktop window. It does not remove the CLI/terminal dependency — it just relocates where the conversation happens after the CLI has already been installed and invoked once.

## Side-by-side Feasibility (Chrome Split Windows)

- Mechanically simple once both servers are running: `opencode web` opens `http://127.0.0.1:<random-port>`, and the Cognnitive editor's `npm run dev` (Vite, in `iNNfo/apps/innfo-editor`, base path `/innfo/app/`) opens its own `http://localhost:<port>` (Vite's default dev port, typically 5173) — two independent localhost tabs, no port conflict since OpenCode picks a random free port ([opencode.ai/docs/web/](https://opencode.ai/docs/web/); `iNNfo/apps/innfo-editor/vite.config.ts`, `iNNfo/apps/innfo-editor/package.json`).
- Chrome's native split-screen / two-window side-by-side is an OS/browser window-management feature, unrelated to either app — no known rough edges here specifically caused by OpenCode.
- Rough edges that DO exist:
  - The OpenCode server's port is random by default, so the URL to open changes each run unless the user learns to pass a fixed port or re-copies the URL the terminal prints.
  - No documented session persistence/sync across tabs, devices, or reloads beyond what the local server process holds in memory — closing the terminal/server process ends the session.
  - Reaching it from a second device (e.g., tablet) needs the `--hostname 0.0.0.0` flag plus manually setting a password (`OPENCODE_SERVER_PASSWORD`); this is not the default and not zero-config ([opencode.ai/docs/web/](https://opencode.ai/docs/web/)).
  - Starting the web server still requires a terminal command, which is exactly the skill gap the "non-technical user" framing wants to avoid.

## Fit for Non-Technical Users

Not a good fit as currently documented. The stated goal — avoiding terminal/CLI comfort requirements — is not met: launching `opencode web` is itself a CLI action, provider API-key setup is unchanged from today, and there is no official zero-install hosted URL to just visit. Once both localhost tabs are up, the *browser* experience itself (two tabs side by side) is easy for anyone, but getting there still requires the exact steps (terminal install, terminal launch, API key management) this workflow was meant to remove. If the goal is a genuinely install-free experience for non-technical users, OpenCode Web as documented today does not deliver that; it only moves OpenCode's own UI into a browser tab after the CLI is already installed and running.

## Sources

1. [opencode.ai/docs/web/](https://opencode.ai/docs/web/) — official docs page for the web UI: client-server architecture, `opencode web` command, localhost binding, `--hostname`, password protection, mDNS.
2. [opencode.ai/docs/](https://opencode.ai/docs/) — official docs intro: installation methods (curl, npm/Bun/pnpm/Yarn, Homebrew, Chocolatey/Scoop/Docker, binaries), provider auth via `/connect` and OpenCode Zen, navigation confirming TUI/CLI/Web/IDE/Zen/Go/GitHub/GitLab as the documented modes.
3. [github.com/sst/opencode](https://github.com/sst/opencode) — README confirms CLI/TUI as primary, a beta Desktop app distributed via opencode.ai/download or GitHub Releases, and [Releases](https://github.com/sst/opencode/releases) for the current version (`v1.18.32`, 2026-09-21).

Repo context checked (not primary OpenCode sources, but relevant to this project):
- `docs/innfo/documentation/installing-ai-agents.md` — this repo's current OpenCode guidance (Desktop/CLI only, no web mode mentioned; recommends `opencode .` in a terminal).
- `docs/innfo/documentation/opencode-innfo-agent.md` — legacy OpenCode agent-definition note, superseded by the skills bundle.
- `iNNfo/apps/innfo-editor/package.json` and `vite.config.ts` — confirm the "Cognnitive Web App" is the `innfo-editor` Vite app, run locally via `npm run dev`, served at `/innfo/app/` on Vite's local dev port.
