---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Workspace Blueprint"
---

# NN Procedure

## NN Procedure: Using the Workspace Blueprint
slug:: using-the-workspace-blueprint
summary:: Getting started with the Workspace blueprint: configure the workspace root, register models and domain blueprints, stage and import external sources, and run validation procedures.
inputs_required:: @workspace-specification
outputs_expected:: @validated-workspace

It starts when: You want to set up, configure, and maintain a cognitive workspace.

### NN Work: Configure the Workspace Root
slug:: configure-the-workspace-root
step_type:: task
next:: @register-models-and-blueprints
condition:: No workspace root defined yet
input:: @workspace-specification
output:: @workspace-root
tool:: @console
executor:: human
scope:: internal
Define the workspace identity, directory structure, conventions, and global configuration.

### NN Work: Register Models and Blueprints
slug:: register-models-and-blueprints
step_type:: task
next:: @import-sources-and-run-procedures
condition:: Workspace root defined
input:: @workspace-root
output:: @registered-workspace
tool:: @console
executor:: human
scope:: internal
Register models, declare blueprint dependencies, and establish domain hierarchy.

### NN Work: Import Sources and Run Procedures
slug:: import-sources-and-run-procedures
step_type:: task
next:: @validate-workspace-integrity
condition:: Workspace configured
input:: @registered-workspace
output:: @processed-sources
tool:: @ai-agent
executor:: agent
scope:: internal
Import visual, audio, video, and tabular sources using workspace procedures.

### NN Work: Validate Workspace Integrity
slug:: validate-workspace-integrity
step_type:: task
condition:: Procedures executed
input:: @processed-sources
output:: @validated-workspace
tool:: @console
executor:: human
scope:: internal
Verify workspace consistency, concept drift, and model linkages against specs.

# NN Tools

## NN Tools: Console
slug:: console
scope:: internal
The domaiNN console, where a person configures and inspects the workspace.

## NN Tools: AI Agent
slug:: ai-agent
scope:: internal
The AI agent that imports sources and runs procedures.

# NN Artifact

## NN Artifact: Workspace Specification
slug:: workspace-specification
The workspace bluepriNNt the domaiNN follows.

## NN Artifact: Workspace Root
slug:: workspace-root
The configured domaiNN root folder.

## NN Artifact: Registered Workspace
slug:: registered-workspace
The domaiNN with its models and bluepriNNts registered.

## NN Artifact: Processed Sources
slug:: processed-sources
The imported sources and the results of the procedures run on them.

## NN Artifact: Validated Workspace
slug:: validated-workspace
The domaiNN after its integrity validation.
