# Installing AI Agents

To edit, bootstrap, and maintain **cogNNitive** knowledge models (`*_NN.md`), you can interact with them visually using the web modeler or drive them directly via **local AI coding agents**.

An AI coding agent is software that runs locally on your computer (desktop app or CLI). Unlike web-based chat interfaces, local agents have secure permission to inspect workspace directories, create files, run validation tools via MCP (Model Context Protocol), and keep your models synchronized.

---

## Recommended AI Agents

| Agent | Type | Best For | Status |
|-------|------|----------|--------|
| **OpenCode** | Desktop App & CLI | Full ecosystem integration, visual diffs, native MCP support | **Recommended** ⭐️ |
| **Claude Code** | Terminal CLI | Deep reasoning, automated refactoring in command line | Supported |
| **Google Antigravity** | Agentic IDE & CLI | Dynamic subagents, enterprise workflows | Supported |
| **Codex** | CLI / Extension | Scripting and programmatic agent automation | Supported |
| **Cursor** | AI-Powered IDE | In-editor agent mode, inline multi-file edits | Supported |

---

## 1. OpenCode (Strongly Recommended)

[OpenCode](https://opencode.ai) is the primary recommended AI coding workspace. It provides both a fast desktop environment and terminal CLI, with native support for multi-model editing and local MCP configurations.

### Installation

- **macOS / Windows / Linux Desktop:** Download the latest installer from [opencode.ai](https://opencode.ai) or the [OpenCode GitHub Releases](https://github.com/opencode-ai/opencode/releases).
- **CLI via Package Managers:**
  - **macOS (Homebrew):** `brew install opencode`
  - **Windows (Winget):** `winget install opencode`
  - **Linux / npm:** `npm install -g opencode-ai`

### Launching OpenCode in your workspace

Open your terminal and navigate to your workspace folder (e.g. ending in `_NN`):

```bash
cd ~/Documents/my-project_NN
opencode .
```

---

## 2. Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) is Anthropic's official command-line agent for autonomous software engineering and markdown editing.

### Installation

Claude Code is distributed as a global npm package:

```bash
npm install -g @anthropic-ai/claude-code
```

### Launching Claude Code

Navigate to your workspace directory and start the interactive session:

```bash
cd ~/Documents/my-project_NN
claude
```

---

## 3. Google Antigravity

Google Antigravity is an agentic pair-programming IDE and CLI with built-in support for persistent memory, dynamic subagents, and spec-driven development.

### Installation & Setup

1. Install the Antigravity CLI or IDE extension via your package manager or Google developer portal.
2. Authenticate your Google developer environment.
3. Open your project directory in Antigravity.

---

## 4. Codex / OpenAI CLI

OpenAI Codex and compatible terminal agents allow scriptable command execution and automated code/markdown synthesis.

### Installation

Follow the installation instructions for your chosen OpenAI CLI distribution (e.g. via `pip` or `npm`) and configure your `OPENAI_API_KEY`.

---

## 5. Cursor

[Cursor](https://cursor.com) is an AI-powered code editor built on VS Code, with a built-in agent mode for autonomous multi-file edits and native MCP server support.

### Installation

Download the installer for your OS from [cursor.com](https://cursor.com).

### Launching Cursor in your workspace

Open your workspace folder (e.g. ending in `_NN`) via **File → Open Folder**, or from your terminal:

```bash
cd ~/Documents/my-project_NN
cursor .
```

---

## Connecting the MCP Server (`innfo-mcp`)

Once your agent is installed, you can connect the `innfo-mcp` Model Context Protocol server. This gives your agent deterministic validation, AST mutation, and spec resolution tools for all `_NN.md` files without manual formatting errors.

For full setup instructions, see the [MCP Setup Guide](mcp-setup).
