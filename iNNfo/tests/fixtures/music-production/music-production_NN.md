---
spec_version: "V_0-1-3"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/v0.1.2/specs/FORMAT_V_0-1-3_FORMAT.md"
level: 3
parent:
  name: "procedures_V_0-1-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/v0.1.1/specs/procedures_V_0-1-1_NN.md"
knowledge_version: "V_0-0-1"
title: "Song Recording Workflow"
---

> [!NOTE]
> This is a **FORMAT document** — procedures model for a complete song recording workflow from demo to mastered track.

# _F index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# _F Procedure

A complete workflow for recording, producing, and releasing a song from initial demo to mastered final track. This procedure covers the standard stages used in professional music production, from songwriting through to final master delivery.

# _F Work

1. _F Work: Songwriting
  ```yaml
  step_type: "task"
  next: "Pre-production"
  tool: "DAW"
  input: "Demo recording"
  output: "Demo recording"
  output_status: "draft"
  ```
  Develop the song structure, chord progressions, melody, and lyrics. Create a rough demo recording.

2. _F Work: Pre-production
  ```yaml
  step_type: "task"
  next: "Tracking"
  tool: "DAW"
  input: "Demo recording"
  output: "Demo recording"
  output_status: "revised"
  ```
  Refine arrangements, plan instrumentation, set tempos and keys, and prepare the production plan.

3. _F Work: Tracking
  ```yaml
  step_type: "task"
  next: "Editing"
  tool: "Microphone"
  input: "Demo recording"
  output: "Multitrack session"
  output_status: "completed"
  ```
  Record each instrument and vocal part on separate tracks. Capture the best takes with proper mic placement.

4. _F Work: Editing
  ```yaml
  step_type: "task"
  next: "Mixing"
  tool: "DAW"
  input: "Multitrack session"
  output: "Multitrack session"
  output_status: "edited"
  ```
  Compile the best takes, adjust timing, tune vocals, and clean up tracks. Prepare for mixing.

5. _F Work: Mixing
  ```yaml
  step_type: "task"
  next: "Mastering"
  tool: "DAW"
  input: "Multitrack session"
  output: "Stereo mix"
  output_status: "completed"
  ```
  Balance levels, apply EQ and compression, add effects, and create the stereo mixdown.

6. _F Work: Mastering
  ```yaml
  step_type: "task"
  next: ""
  tool: "DAW"
  input: "Stereo mix"
  output: "Mastered track"
  output_status: "final"
  ```
  Polish the stereo mix, ensure consistency across album tracks, prepare final delivery formats.

# _F Artifact

* _F Artifact: Demo recording
  Rough initial recording capturing the song's core structure and arrangement.
* _F Artifact: Multitrack session
  Project file with all individual recorded tracks, edits, and processing.
* _F Artifact: Stereo mix
  Final mixed stereo audio file with all elements balanced and processed.
* _F Artifact: Mastered track
  Final polished audio file ready for distribution across all platforms.

# _F Tools

* _F Tools: DAW
  Digital Audio Workstation for recording, editing, and mixing. Examples: Pro Tools, Logic Pro, Ableton Live.
* _F Tools: Microphone
  High-quality condenser and dynamic microphones for capturing vocals and instruments.
* _F Tools: Audio interface
  Hardware that converts analog signals to digital and connects microphones/instruments to the DAW.
* _F Tools: Monitoring headphones
  Studio headphones and monitors for accurate audio playback during recording and mixing.

# _F Roles

* _F Roles: Producer
  ```yaml
  scope: "internal"
  ```
  Oversees the creative vision, guides artists, and makes key production decisions.
* _F Roles: Recording Engineer
  ```yaml
  scope: "internal"
  ```
  Sets up microphones, operates recording equipment, and captures clean takes.
* _F Roles: Mixing Engineer
  ```yaml
  scope: "internal"
  ```
  Blends and processes all tracks into a cohesive stereo mix.
* _F Roles: Mastering Engineer
  ```yaml
  scope: "external"
  ```
  Finalizes the stereo mix for distribution across formats and platforms.

# _F matrices: work-roles matrix

| Work \ Roles | Producer | Recording Engineer | Mixing Engineer | Mastering Engineer |
| :--- | :---: | :---: | :---: | :---: |
| Songwriting | Responsible | — | — | — |
| Pre-production | Accountable | Consulted | — | — |
| Tracking | Accountable | Responsible | — | — |
| Editing | Consulted | Responsible | — | — |
| Mixing | Consulted | — | Responsible | — |
| Mastering | — | — | Consulted | Responsible |

# _F matrices: work-tools matrix

| Work \ Tools | DAW | Microphone | Audio interface | Monitoring headphones |
| :--- | :---: | :---: | :---: | :---: |
| Songwriting | Uses | — | — | — |
| Pre-production | Uses | — | — | — |
| Tracking | Uses | Uses | Uses | Uses |
| Editing | Uses | — | — | Uses |
| Mixing | Uses | — | Uses | Uses |
| Mastering | Uses | — | Uses | Uses |

# _F matrices: work-artifacts matrix

| Work \ Artifact | Demo recording | Multitrack session | Stereo mix | Mastered track |
| :--- | :---: | :---: | :---: | :---: |
| Songwriting | Creates | — | — | — |
| Pre-production | Modifies | — | — | — |
| Tracking | — | Creates | — | — |
| Editing | — | Modifies | — | — |
| Mixing | — | — | Creates | — |
| Mastering | — | — | Modifies | Creates |
