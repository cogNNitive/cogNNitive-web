---
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Setup GitHub Pages Repo Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Procedure

## NN Procedure: Setup GitHub Pages Repo
category:: infrastructure
summary:: Verify local Git and GitHub CLI tooling (offering automated platform installation if missing), initialize an isolated public Git repository scoped strictly inside the web/ directory to prevent private workspace leaks, create the remote public GitHub repository, and activate GitHub Pages serving from the root.
inputs_required:: Published Web Portal Artifacts in web/
outputs_expected:: Live GitHub Pages Deployment and Public URL
executed_by:: Release Engineer
procedure_model:: procedures/setup_github_pages_repo_procedures_NN.md

# NN Work

## NN Work: Setup GitHub Pages Repo Workflow
step_type:: task
next:: [[Check and Install Git Tooling]]
condition:: Web portal artifacts are present in the web/ directory
input:: [[Web Portal Artifacts]]
output:: [[Live GitHub Pages Deployment]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Orchestrate end-to-end repository initialization and public hosting for the video web portal: ensure Git and GitHub CLI are available on the host machine, initialize an independent Git repository rooted inside `web/`, create the public GitHub repository, push the initial commit, and enable GitHub Pages at the repository root.

## NN Work: Check and Install Git Tooling
parent:: [[Setup GitHub Pages Repo Workflow]]
step_type:: task
next:: [[Authenticate GitHub Session]]
condition:: Procedure is triggered
input:: [[Host Environment]]
output:: [[Configured Tooling Environment]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Inspect the host system by running `git --version` and `gh --version`. If either tool is missing, detect the operating system and execute or propose the appropriate non-interactive package manager command (e.g. `winget install --id Git.Git -e --source winget` and `winget install --id GitHub.cli -e` on Windows, `brew install git gh` on macOS, `sudo apt-get install git gh` on Linux). Verify installations before proceeding.

## NN Work: Authenticate GitHub Session
parent:: [[Setup GitHub Pages Repo Workflow]]
step_type:: task
next:: [[Initialize Isolated Web Repository]]
condition:: Git and GitHub CLI are available
input:: [[Configured Tooling Environment]]
output:: [[Authenticated GitHub Session]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Run `gh auth status` to check whether the user has an active authenticated session with GitHub. If unauthenticated, prompt the user and invoke `gh auth login --web` to guide a frictionless browser-based authentication flow.

## NN Work: Initialize Isolated Web Repository
parent:: [[Setup GitHub Pages Repo Workflow]]
step_type:: task
next:: [[Create Remote Repo and Enable Pages]]
condition:: GitHub CLI session is authenticated
input:: [[Web Portal Artifacts]], [[Authenticated GitHub Session]]
output:: [[Initialized Local Repository]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Navigate to the `web/` directory. If `web/.git` does not exist, run `git init -b main` strictly inside `web/`. Create a local `.gitignore` inside `web/` (ignoring `.DS_Store`, OS temporary files, and local logs). If the parent workspace also contains a Git repository, ensure `web/` is added to the parent's `.gitignore` to avoid nested repository conflicts. Stage all web files (`index.html`, `data/videos.json`, `content/*.md`, `.nojekyll`) and create the initial commit: `git commit -m "feat: initial video portal release"`.

## NN Work: Create Remote Repo and Enable Pages
parent:: [[Setup GitHub Pages Repo Workflow]]
step_type:: task
condition:: Local repository inside web/ is committed
input:: [[Initialized Local Repository]]
output:: [[Live GitHub Pages Deployment]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
From within the `web/` directory, create the public remote repository and push the `main` branch using GitHub CLI: `gh repo create <repo-name> --public --source=. --remote=origin --push`. Activate GitHub Pages serving from the root of `main` via `gh api -X POST repos/{owner}/{repo}/pages -f source='{"branch":"main","path":"/"}'`. Print the live public URL (`https://<username>.github.io/<repo-name>/`) and instruct the user that this URL is ready to be linked in YouTube video descriptions.

# NN Artifact

## NN Artifact: Web Portal Artifacts
type:: input
description:: The standalone web portal files located in `web/` (`index.html`, `data/videos.json`, `content/*.md`, `.nojekyll`).

## NN Artifact: Host Environment
type:: input
description:: Operating system environment and available command-line package managers (`winget`, `brew`, `apt`).

## NN Artifact: Configured Tooling Environment
type:: intermediate
description:: Environment with confirmed functional `git` and `gh` executables.

## NN Artifact: Authenticated GitHub Session
type:: intermediate
description:: Active GitHub credentials verified by `gh auth status`.

## NN Artifact: Initialized Local Repository
type:: intermediate
description:: Isolated Git repository initialized at `web/.git` on branch `main` with committed portal assets.

## NN Artifact: Live GitHub Pages Deployment
type:: output
description:: Publicly accessible GitHub Pages site hosting the video catalog and source notes.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent managing environment discovery, tool installation commands, and GitHub API interactions.

## NN Tools: File Editor
type:: automated
description:: Tool creating repository configuration files and `.gitignore` entries.

# NN Roles

## NN Roles: Release Engineer
type:: owner
description:: Authorizes public repository creation, specifies repository naming conventions, and manages public deployment endpoints.
