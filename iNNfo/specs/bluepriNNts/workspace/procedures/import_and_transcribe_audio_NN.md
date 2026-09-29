---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Audio Source Import & Transcription Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).
>
> **Experimental External Ingestion**: Audio conversion (ffmpeg) and speech-to-text transcription (Whisper/ASR engine) are external helper processes assisted by the AI agent or user environment. cogNNitive natively manages the resulting normalized Markdown and provenance tracing.

# NN index

* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Work

## NN Work: Import and Transcribe Audio Sources
step_type:: task
parent:: -
next:: -
condition:: Raw audio recordings present in import or external drop folder
input:: [[Raw Audio Recordings Directory]]
output:: [[Verified Target Domain Model]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Ingest unprocessed audio recordings, orchestrate speech-to-text transcription via external ASR tooling, normalize transcripts into sources/nn/ with companion media linking, bind normalized sources to target domain model elements, and validate semantic integrity.

## NN Work: Discover Raw Audio Files
parent:: [[Import and Transcribe Audio Sources]]
step_type:: task
next:: [[Verify and Deduplicate Sources]]
condition:: Ingestion workflow triggered
input:: [[Raw Audio Recordings Directory]]
output:: [[Unprocessed Audio List]]
output_status:: verified
tool:: [[Command Line Interface]]
scope:: internal
Scan the audio drop or import folder (e.g., sources/import/ or external watch root) to identify audio files (.mp3, .wav, .m4a, .ogg) that lack corresponding transcript files (.txt, .srt).

## NN Work: Verify and Deduplicate Sources
parent:: [[Import and Transcribe Audio Sources]]
step_type:: decision
next:: [[Transcribe Audio via External ASR]]
condition:: Unprocessed audio list generated
input:: [[Unprocessed Audio List]]
output:: [[Verified Audio Ingestion Queue]]
output_status:: verified
tool:: [[Command Line Interface]]
scope:: internal
Compute SHA-256 hashes for discovered audio files and verify against existing normalized sources in sources/nn/ and sources/archive/ to prevent duplicate processing.

## NN Work: Transcribe Audio via External ASR
parent:: [[Import and Transcribe Audio Sources]]
step_type:: task
next:: [[Stage Transcriptions with Media Link]]
condition:: Ingestion queue validated
input:: [[Verified Audio Ingestion Queue]]
output:: [[Raw Transcript and Subtitles]]
output_status:: verified
tool:: [[ASR Transcription Engine]]
scope:: external
Convert audio to 16 kHz mono WAV via ffmpeg (chunking long files if needed) and transcribe speech using an external ASR engine (faster-whisper, Whisper API, or whisper.cpp). Generate text transcripts and timestamped SRT subtitle files.

## NN Work: Stage Transcriptions with Media Link
parent:: [[Import and Transcribe Audio Sources]]
step_type:: task
next:: [[Normalize Sources via Scanner]]
condition:: Transcripts generated
input:: [[Raw Transcript and Subtitles]]
output:: [[Staged Source Import Files]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Place generated .txt transcriptions into sources/import/ matching the base name of the source audio file to enable automatic same-stem companion media pairing.

## NN Work: Normalize Sources via Scanner
parent:: [[Import and Transcribe Audio Sources]]
step_type:: task
next:: [[Bind Normalized Source to Target Entity]]
condition:: Transcripts staged in sources/import/
input:: [[Staged Source Import Files]]
output:: [[Normalized Markdown Sources]]
output_status:: verified
tool:: [[nn-trannsform Scanner]]
scope:: internal
Run the nn-trannsform scanner to convert staged text into sources/nn/ Markdown files with mandatory provenance frontmatter (source_file, media_file, sha256, normalized_at).

## NN Work: Bind Normalized Source to Target Entity
parent:: [[Import and Transcribe Audio Sources]]
step_type:: task
next:: [[Validate Target Model]]
condition:: Normalized sources created
input:: [[Normalized Markdown Sources]]
output:: [[Updated Domain Model]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Update the sources:: field of the target Element in the active domain model with the normalized source path. Confirm entity mappings with the user when ambiguous.

## NN Work: Validate Target Model
parent:: [[Import and Transcribe Audio Sources]]
step_type:: task
next:: -
condition:: Domain model updated
input:: [[Updated Domain Model]]
output:: [[Verified Target Domain Model]]
output_status:: verified
tool:: [[innfo-mcp]]
scope:: internal
Execute validate_model on the target domain model via innfo-mcp to ensure reference integrity and schema compliance.

# NN Tools

## NN Tools: AI Agent
scope:: internal
LLM agent orchestrating the multi-step audio ingestion, file handling, and model enrichment procedure.

## NN Tools: Command Line Interface
scope:: internal
Terminal environment for directory inspection, hash calculations, and file management.

## NN Tools: ASR Transcription Engine
scope:: external
External speech-to-text tool (e.g., faster-whisper, Whisper API, whisper.cpp, ffmpeg) providing automated audio transcription.

## NN Tools: nn-trannsform Scanner
scope:: internal
Built-in scanner script normalizing staged imports into Markdown with provenance frontmatter.

## NN Tools: File Editor
scope:: internal
Tool for writing staged transcripts and editing Level 3 model files.

## NN Tools: innfo-mcp
scope:: internal
Deterministic MCP server validating iNNfo models against Level 2 templates.

# NN Artifact

## NN Artifact: Raw Audio Recordings Directory
type:: spec
format:: directory
Directory containing raw input audio files (.mp3, .wav, .m4a).

## NN Artifact: Unprocessed Audio List
type:: data
format:: json
List of discovered audio recordings missing companion transcripts.

## NN Artifact: Verified Audio Ingestion Queue
type:: data
format:: json
Queue of audio files cleared of duplicates and ready for transcription.

## NN Artifact: Raw Transcript and Subtitles
type:: deliverable
format:: markdown
Text (.txt) and subtitle (.srt) transcripts produced by the ASR engine.

## NN Artifact: Staged Source Import Files
type:: data
format:: directory
Files staged in sources/import/ ready for scanner normalization.

## NN Artifact: Normalized Markdown Sources
type:: spec
format:: markdown
Traceable Markdown files in sources/nn/ with origin frontmatter and media linking.

## NN Artifact: Updated Domain Model
type:: spec
format:: markdown
Domain model file enriched with provenance citations in its sources:: fields.

## NN Artifact: Verified Target Domain Model
type:: report
format:: status
Validation confirmation confirming model integrity and zero broken references.

# NN Roles

## NN Roles: iNNfo Agent
scope:: internal
AI agent executing procedural steps, file normalization, and model updates.

## NN Roles: Workspace Maintainer
scope:: external
Human owner reviewing transcripts, confirming entity mappings, and approving model changes.

# NN matrices: work-roles matrix

| Work \ Roles | iNNfo Agent | Workspace Maintainer |
| :--- | :---: | :---: |
| Import and Transcribe Audio Sources | Responsible | Accountable |
| Discover Raw Audio Files | Responsible | Informed |
| Verify and Deduplicate Sources | Responsible | Informed |
| Transcribe Audio via External ASR | Responsible | Informed |
| Stage Transcriptions with Media Link | Responsible | Informed |
| Normalize Sources via Scanner | Responsible | Informed |
| Bind Normalized Source to Target Entity | Responsible | Accountable |
| Validate Target Model | Responsible | Informed |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | Command Line Interface | ASR Transcription Engine | nn-trannsform Scanner | File Editor | innfo-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Transcribe Audio Sources | Uses | - | - | - | - | - |
| Discover Raw Audio Files | - | Uses | - | - | - | - |
| Verify and Deduplicate Sources | - | Uses | - | - | - | - |
| Transcribe Audio via External ASR | - | - | Uses | - | - | - |
| Stage Transcriptions with Media Link | - | - | - | - | Uses | - |
| Normalize Sources via Scanner | - | - | - | Uses | - | - |
| Bind Normalized Source to Target Entity | - | - | - | - | Uses | - |
| Validate Target Model | - | - | - | - | - | Uses |

# NN matrices: work-artifacts matrix

| Work \ Artifact | Raw Audio Recordings Directory | Unprocessed Audio List | Verified Audio Ingestion Queue | Raw Transcript and Subtitles | Staged Source Import Files | Normalized Markdown Sources | Updated Domain Model | Verified Target Domain Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Transcribe Audio Sources | Reviews | - | - | - | - | - | - | Creates |
| Discover Raw Audio Files | Reviews | Creates | - | - | - | - | - | - |
| Verify and Deduplicate Sources | - | Reviews | Creates | - | - | - | - | - |
| Transcribe Audio via External ASR | - | - | Reviews | Creates | - | - | - | - |
| Stage Transcriptions with Media Link | - | - | - | Reviews | Creates | - | - | - |
| Normalize Sources via Scanner | - | - | - | - | Reviews | Creates | - | - |
| Bind Normalized Source to Target Entity | - | - | - | - | - | Reviews | Modifies | - |
| Validate Target Model | - | - | - | - | - | - | Validates | Creates |