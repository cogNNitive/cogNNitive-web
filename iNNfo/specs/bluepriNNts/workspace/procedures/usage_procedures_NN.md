---
level: 3
parent_spec:
  name: "procedures_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Workspace Blueprint"
---

# NN Work

## NN Work: Using the Workspace Blueprint
step_type:: task
condition:: You want to set up, configure, and maintain a cognitive workspace
input:: [[Workspace Specification]]
output:: [[Validated Workspace]]
tool:: [[Console]]
scope:: internal
Getting started with the Workspace blueprint: configure the workspace root, register models and domain blueprints, stage and import external sources, and run validation procedures.

## NN Work: Configure the Workspace Root
parent:: [[Using the Workspace Blueprint]]
step_type:: task
next:: [[Register Models and Blueprints]]
condition:: No workspace root defined yet
input:: [[Workspace Specification]]
output:: [[Workspace Root]]
tool:: [[Console]]
scope:: internal
Define the workspace identity, directory structure, conventions, and global configuration.

## NN Work: Register Models and Blueprints
parent:: [[Using the Workspace Blueprint]]
step_type:: task
next:: [[Import Sources and Run Procedures]]
condition:: Workspace root defined
input:: [[Workspace Root]]
output:: [[Registered Workspace]]
tool:: [[Console]]
scope:: internal
Register models, declare blueprint dependencies, and establish domain hierarchy.

## NN Work: Import Sources and Run Procedures
parent:: [[Using the Workspace Blueprint]]
step_type:: task
next:: [[Validate Workspace Integrity]]
condition:: Workspace configured
input:: [[Registered Workspace]]
output:: [[Processed Sources]]
tool:: [[AI Agent]]
scope:: internal
Import visual, audio, video, and tabular sources using workspace procedures.

## NN Work: Validate Workspace Integrity
parent:: [[Using the Workspace Blueprint]]
step_type:: task
condition:: Procedures executed
input:: [[Processed Sources]]
output:: [[Validated Workspace]]
tool:: [[Console]]
scope:: internal
Verify workspace consistency, concept drift, and model linkages against specs.
