---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
blueprint_version: "V_0-2-1"
knowledge_version: "V_0-1-0"
title: "Use iNNfo with AI"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Work]]
* [[Tools]]
* [[Roles]]
* [[Artifact]]

# NN Work

## NN Work: Use iNNfo with AI
iNNfo lets you edit and view iNNfo models both from its graphical interface and through AI agents. This procedure describes how to work with your models via natural language conversation across modern AI coding agents (OpenCode Desktop, Google Antigravity, Claude Code, Codex / OpenAI, Cursor), leveraging the contextual prompts the application provides.

## NN Work: Download and install OpenCode Desktop
step_type:: task
tool:: [[OpenCode Desktop]]
Download OpenCode Desktop from https://opencode.ai/download and install it. OpenCode Desktop is the recommended reference desktop client for iNNfo — it reads project skills natively and discovers them automatically. You can also use other AI coding environments such as Google Antigravity, Claude Code, Cursor, or Codex.

## NN Work: Open the workspace folder in your AI agent
parent:: [[Use iNNfo with AI]]
step_type:: task
input:: [[Workspace Folder]]
tool:: [[OpenCode Desktop]]
Open the same workspace folder you use in iNNfo inside OpenCode Desktop or your chosen AI coding agent. You can find the exact path at the top of the header by clicking the info icon. The agent works directly on the file system.

## NN Work: Configure MCP tools
parent:: [[Use iNNfo with AI]]
step_type:: task
tool:: [[OpenCode Desktop]]
The first time you work with models, tell your AI agent: *"innfo: Load the nn-innfo skill and check that innfo-mcp is configured"*. The skill detects if the MCP server is set up and guides you through any steps if needed. Reference: `docs/mcp-setup.md`.

## NN Work: Edit models via chat
parent:: [[Use iNNfo with AI]]
step_type:: task
input:: [[Model File]]
output:: [[Edited Model File]]
tool:: [[OpenCode Desktop]]
Tell your AI agent what you want to do including a reference to the skill you need, for example: *"innfo: Load the nn-innfo skill — I need to edit a model and add a new concept"*. The skill reference in your message helps the agent discover and activate the right skill automatically. The skill provides model validation, MCP activation, and change workflows.

## NN Work: Use the suggested prompts
parent:: [[Use iNNfo with AI]]
step_type:: task
input:: [[Suggested Prompts]]
tool:: [[OpenCode Desktop]]
When viewing a model in iNNfo, the right sidebar shows **suggested prompts** for each concept. Copy them into OpenCode Desktop or your AI agent to explore a specific concept or element in more detail.

# NN Roles

## NN Roles: User
scope:: internal
Person who directs model editing. Describes the changes they want in natural language and the agent executes them.

## NN Roles: AI Agent
scope:: external
AI agent (e.g. OpenCode Desktop, Google Antigravity, Claude Code, Cursor, Codex) that interprets user instructions and modifies model files directly on the file system.

# NN Artifact

## NN Artifact: Model File
`_NN.md` file containing the iNNfo model. The main artifact edited and viewed both in iNNfo and through the AI agent.

## NN Artifact: Workspace Folder
Local folder containing the model, its templates, and associated specs. The directory you share between iNNfo and your AI agent so both work on the same files.

## NN Artifact: Suggested Prompts
Text snippets that appear in the iNNfo right sidebar when you select a concept. Designed to be copied and pasted into your AI agent.

## NN Artifact: Edited Model File
Updated `_NN.md` model file containing valid elements, fields, and matrices conforming to its declared template.

# NN Tools

## NN Tools: OpenCode Desktop
Recommended reference desktop client for iNNfo. Reads project skills natively and discovers them automatically. Download: https://opencode.ai/download

## NN Tools: AI Coding Agents
Compatible with modern AI coding agents including Google Antigravity, Claude Code, Cursor, and Codex CLI supporting MCP and skill workflows. Download: https://cognnitive.com/use

# NN matrices: work-roles matrix

| Work \ Roles | User | AI Agent |
| :--- | :---: | :---: |
| Download and install OpenCode Desktop | Responsible | - |
| Open the workspace folder in your AI agent | Responsible | - |
| Configure MCP tools | Responsible | Accountable |
| Edit models via chat | Responsible | Accountable |
| Use the suggested prompts | Responsible | Consulted |
