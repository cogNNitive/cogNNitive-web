---
level: 3
parent_spec:
  name: "procedures_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Audio Source Import & Transcription Procedure"
slots:
  - { name: batch, kind: value, required: true }
  - { name: import_dir, kind: value, required: false, default: "sources/import" }
---

>
> **Experimental External Ingestion**: Audio conversion (ffmpeg) and speech-to-text transcription (Whisper/ASR engine) are external helper processes assisted by the AI agent or user environment. cogNNitive natively manages the resulting transcript sources and their sidecar provenance.

# NN index

* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Work

The run takes two slots: `batch`, a lowercase name for this intake (its working files live
under `artifacts/intake/{batch}/`), and `import_dir`, the folder scanned for audio
(default `sources/import`). Engine steps run portable `node -e` commands from the domaiNN
root, so they need nothing but Node.js; the transcription itself is agent work, and a person
approves the transcripts before anything becomes a citable source.

## NN Work: Import and Transcribe Audio Sources
slug:: import-and-transcribe-audio-sources
step_type:: task
condition:: Raw audio recordings present in import or external drop folder
input:: @raw-audio-recordings-directory
output:: @verified-target-domain-model
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Ingest unprocessed audio recordings, orchestrate speech-to-text transcription via external ASR tooling, have a person approve the transcripts, cognitivize them in place as citable sources with sidecar provenance, bind them to target domain model elements, and validate semantic integrity.

## NN Work: Discover Raw Audio Files
slug:: discover-raw-audio-files
parent:: @import-and-transcribe-audio-sources
step_type:: task
next:: @verify-and-deduplicate-sources
condition:: Ingestion workflow triggered
input:: @raw-audio-recordings-directory
output:: @unprocessed-audio-list
output_status:: verified
tool:: @command-line-interface
executor:: engine
command:: node -e "const fs=require('fs'),p=require('path');const [d,o]=process.argv.slice(1);const A=['.mp3','.wav','.m4a','.ogg','.flac','.opus'],T=['.txt','.srt','.vtt','.md'];const out=[];const walk=x=>{for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=p.join(x,e.name);const ext=p.extname(e.name).toLowerCase();if(e.isDirectory())walk(f);else if(A.includes(ext)&&!T.some(t=>fs.existsSync(f.slice(0,-ext.length)+t)))out.push(f.split(p.sep).join('/'))}};if(fs.existsSync(d))walk(d);fs.mkdirSync(p.dirname(o),{recursive:true});fs.writeFileSync(o,JSON.stringify({dir:d,audio:out.sort()},null,2)+'\n');console.log(out.length+' audio file(s) without a transcript in '+d);if(out.length===0)process.exitCode=1" "{import_dir}" "artifacts/intake/{batch}/audio-list.json"
scope:: internal
Scan the import folder `{import_dir}` recursively to identify audio files (.mp3, .wav, .m4a, .ogg, .flac, .opus) that lack a same-stem transcript file (.txt, .srt, .vtt, .md), and write them to `artifacts/intake/{batch}/audio-list.json`. The step fails when there is no audio to transcribe, so an empty drop folder never runs an empty batch.

## NN Work: Verify and Deduplicate Sources
slug:: verify-and-deduplicate-sources
parent:: @import-and-transcribe-audio-sources
step_type:: task
next:: @transcribe-audio-via-external-asr
condition:: Unprocessed audio list generated
input:: @unprocessed-audio-list
output:: @verified-audio-ingestion-queue
output_status:: verified
tool:: @command-line-interface
executor:: engine
command:: node -e "const fs=require('fs'),p=require('path'),c=require('crypto');const [l,t,o]=process.argv.slice(1);const list=JSON.parse(fs.readFileSync(l,'utf8')).audio;const known=new Set();const walk=x=>{if(!fs.existsSync(x))return;for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=p.join(x,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('_sidecar_NN.md'))for(const m of fs.readFileSync(f,'utf8').matchAll(/^(media_)?sha256:[ ]*.?([0-9a-f]{64})/gm))known.add(m[2])}};walk('sources');const queue=[],skipped=[],stems=new Set();for(const f of list){const h=c.createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(known.has(h)){skipped.push({file:f,sha256:h});continue}known.add(h);const base=p.basename(f,p.extname(f));let stem=base;for(let i=2;stems.has(stem);i++)stem=base+'-'+i;stems.add(stem);queue.push({file:f,sha256:h,transcript:t+'/'+stem+'.txt',staged:p.dirname(f).split(p.sep).join('/')+'/'+base+'.txt'})}fs.writeFileSync(o,JSON.stringify({queue:queue,skipped:skipped},null,2)+'\n');console.log(queue.length+' queued, '+skipped.length+' skipped as already known');if(queue.length===0)process.exitCode=1" "artifacts/intake/{batch}/audio-list.json" "artifacts/intake/{batch}/transcripts" "artifacts/intake/{batch}/audio-queue.json"
scope:: internal
Compute SHA-256 hashes for the discovered audio files and drop every file whose bytes are already recorded (`sha256` or `media_sha256`) in a sidecar under `sources/`, or repeat a file earlier in the same batch, to prevent duplicate processing. Each queued entry names the transcript file the next step must write (`artifacts/intake/{batch}/transcripts/<stem>.txt`) and where it will be staged (beside the audio). The step fails when nothing is left to transcribe.

## NN Work: Transcribe Audio via External ASR
slug:: transcribe-audio-via-external-asr
parent:: @import-and-transcribe-audio-sources
step_type:: task
next:: @review-the-transcripts
condition:: Ingestion queue validated
input:: @verified-audio-ingestion-queue
output:: @raw-transcript-and-subtitles
output_status:: verified
tool:: @asr-transcription-engine
executor:: agent
produces:: one transcript per queued entry, at the `transcript` path `artifacts/intake/{batch}/audio-queue.json` names, plus an optional `.srt` beside it
scope:: external
Convert audio to 16 kHz mono WAV via ffmpeg (chunking long files if needed) and transcribe speech using an external ASR engine (faster-whisper, Whisper API, or whisper.cpp). Generate text transcripts and timestamped SRT subtitle files under `artifacts/intake/{batch}/transcripts/`; nothing is written to the import folder yet.

## NN Work: Review the Transcripts
slug:: review-the-transcripts
parent:: @import-and-transcribe-audio-sources
step_type:: decision
next:: [@stage-transcriptions-with-media-link, @record-the-rejected-batch]
condition:: Transcripts generated
input:: @raw-transcript-and-subtitles
tool:: @console
executor:: human
decision:: Are the transcripts in artifacts/intake/{batch}/transcripts/ faithful enough to become citable sources? Answer approve to stage and cognitivize them, or reject to stop this batch without staging anything.
scope:: internal
The Workspace Maintainer reads the transcripts against the recordings. Approval is the only way a transcript reaches the import folder; a rejected batch leaves the domaiNN untouched, and a corrected batch is started as a new run.

## NN Work: Stage Transcriptions with Media Link
slug:: stage-transcriptions-with-media-link
parent:: @import-and-transcribe-audio-sources
step_type:: task
next:: @cognitivize-the-staged-transcripts
condition:: outcome == approve
input:: @raw-transcript-and-subtitles
output:: @staged-source-import-files
output_status:: verified
tool:: @command-line-interface
executor:: engine
command:: node -e "const fs=require('fs');const [q,o]=process.argv.slice(1);const queue=JSON.parse(fs.readFileSync(q,'utf8')).queue;const staged=[],missing=[],kept=[];for(const e of queue){if(!fs.existsSync(e.transcript)){missing.push(e.transcript);continue}if(fs.existsSync(e.staged)){kept.push(e.staged);continue}fs.copyFileSync(e.transcript,e.staged);staged.push(e.staged)}fs.writeFileSync(o,JSON.stringify({staged:staged,kept:kept,missing:missing},null,2)+'\n');console.log(staged.length+' staged, '+kept.length+' already present, '+missing.length+' missing');if(missing.length>0)process.exitCode=1" "artifacts/intake/{batch}/audio-queue.json" "artifacts/intake/{batch}/staged.json"
scope:: internal
Copy each approved .txt transcript into the import folder beside its audio file, under the audio's base name, and record the result in `artifacts/intake/{batch}/staged.json`. An existing file of that name is never overwritten, and a queued entry whose transcript is missing fails the step.

## NN Work: Cognitivize the Staged Transcripts
slug:: cognitivize-the-staged-transcripts
parent:: @import-and-transcribe-audio-sources
step_type:: task
next:: @bind-normalized-source-to-target-entity
condition:: Transcripts staged in the import folder
input:: @staged-source-import-files
output:: @cognitivized-transcript-sources
output_status:: verified
tool:: @nn-sources-scanner
executor:: agent
produces:: a co-located `<transcript>_sidecar_NN.md` for every path `artifacts/intake/{batch}/staged.json` lists
scope:: internal
Cognitivize every staged transcript in place, through the nn-sources scanner (`--scan` or `--cognitivize <file>`) or the MCP `cognitivize` tool, so each gets a co-located sidecar with its provenance (source_file, sha256, normalized_at). The raw audio stays untouched.

## NN Work: Bind Normalized Source to Target Entity
slug:: bind-normalized-source-to-target-entity
parent:: @import-and-transcribe-audio-sources
step_type:: task
next:: @validate-target-model
condition:: Transcript sources cognitivized
input:: @cognitivized-transcript-sources
output:: @updated-domain-model
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Update the sources:: field of the target Element in the active domain model with the transcript source path, through a proposed changeset. Confirm entity mappings with the user when ambiguous.

## NN Work: Validate Target Model
slug:: validate-target-model
parent:: @import-and-transcribe-audio-sources
step_type:: task
condition:: Domain model updated
input:: @updated-domain-model
output:: @verified-target-domain-model
output_status:: verified
tool:: @innfo-mcp
executor:: agent
scope:: internal
Execute validate_knowledge on the target domain model via innfo-mcp to ensure reference integrity and schema compliance.

## NN Work: Record the Rejected Batch
slug:: record-the-rejected-batch
parent:: @import-and-transcribe-audio-sources
step_type:: task
condition:: outcome == reject
input:: @raw-transcript-and-subtitles
output:: @rejected-batch-note
output_status:: verified
tool:: @ai-agent
executor:: agent
produces:: artifacts/intake/{batch}/review-rejected.md
scope:: internal
Write `artifacts/intake/{batch}/review-rejected.md` with the reviewer's reason and the queued audio files, so the batch can be transcribed again in a new run. Nothing is staged, cognitivized or bound.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
scope:: internal
LLM agent orchestrating the multi-step audio ingestion, file handling, and model enrichment procedure.

## NN Tools: Command Line Interface
slug:: command-line-interface
scope:: internal
Terminal environment for directory inspection, hash calculations, and file management; the engine steps run their `node -e` commands here.

## NN Tools: ASR Transcription Engine
slug:: asr-transcription-engine
scope:: external
External speech-to-text tool (e.g., faster-whisper, Whisper API, whisper.cpp, ffmpeg) providing automated audio transcription.

## NN Tools: Console
slug:: console
scope:: internal
The domaiNN console, where the Workspace Maintainer answers the review decision.

## NN Tools: nn-sources Scanner
slug:: nn-sources-scanner
scope:: internal
The nn-sources skill's scanner (`--scan`, `--cognitivize`), also behind the MCP `cognitivize` tool, which writes co-located sidecars with provenance for staged sources.

## NN Tools: File Editor
slug:: file-editor
scope:: internal
Tool for writing staged transcripts and editing Level 3 model files.

## NN Tools: innfo-mcp
slug:: innfo-mcp
scope:: internal
Deterministic MCP server validating iNNfo models against Level 2 templates.

# NN Artifact

## NN Artifact: Raw Audio Recordings Directory
slug:: raw-audio-recordings-directory
type:: spec
format:: directory
Directory containing raw input audio files (.mp3, .wav, .m4a), `{import_dir}` of the run.

## NN Artifact: Unprocessed Audio List
slug:: unprocessed-audio-list
type:: data
format:: json
verify:: file:artifacts/intake/{batch}/audio-list.json
List of discovered audio recordings missing companion transcripts.

## NN Artifact: Verified Audio Ingestion Queue
slug:: verified-audio-ingestion-queue
type:: data
format:: json
verify:: file:artifacts/intake/{batch}/audio-queue.json
Queue of audio files cleared of duplicates and ready for transcription, each with its transcript and staging paths.

## NN Artifact: Raw Transcript and Subtitles
slug:: raw-transcript-and-subtitles
type:: deliverable
format:: markdown
verify:: human
Text (.txt) and subtitle (.srt) transcripts produced by the ASR engine under `artifacts/intake/{batch}/transcripts/`.

## NN Artifact: Staged Source Import Files
slug:: staged-source-import-files
type:: data
format:: json
verify:: file:artifacts/intake/{batch}/staged.json
The transcripts copied beside their audio in the import folder, listed in `staged.json`.

## NN Artifact: Cognitivized Transcript Sources
slug:: cognitivized-transcript-sources
type:: spec
format:: markdown
Staged transcripts with their co-located sidecars, citable as sources.

## NN Artifact: Updated Domain Model
slug:: updated-domain-model
type:: spec
format:: markdown
Domain model file enriched with provenance citations in its sources:: fields.

## NN Artifact: Verified Target Domain Model
slug:: verified-target-domain-model
type:: report
format:: status
Validation confirmation confirming model integrity and zero broken references.

## NN Artifact: Rejected Batch Note
slug:: rejected-batch-note
type:: report
format:: markdown
verify:: file:artifacts/intake/{batch}/review-rejected.md
The reviewer's reason for rejecting the batch and the audio files it held.

# NN Roles

## NN Roles: iNNfo Agent
slug:: innfo-agent
scope:: internal
AI agent executing procedural steps, file normalization, and model updates.

## NN Roles: Workspace Maintainer
slug:: workspace-maintainer
scope:: external
Human owner reviewing transcripts, confirming entity mappings, and approving model changes.

# NN matrices: work-roles matrix

| Work \ Roles | iNNfo Agent | Workspace Maintainer |
| :--- | :---: | :---: |
| Import and Transcribe Audio Sources | Responsible | Accountable |
| Discover Raw Audio Files | Responsible | Informed |
| Verify and Deduplicate Sources | Responsible | Informed |
| Transcribe Audio via External ASR | Responsible | Informed |
| Review the Transcripts | Informed | Responsible |
| Stage Transcriptions with Media Link | Responsible | Informed |
| Cognitivize the Staged Transcripts | Responsible | Informed |
| Bind Normalized Source to Target Entity | Responsible | Accountable |
| Validate Target Model | Responsible | Informed |
| Record the Rejected Batch | Responsible | Informed |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | Command Line Interface | ASR Transcription Engine | Console | nn-sources Scanner | File Editor | innfo-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Transcribe Audio Sources | Uses | - | - | - | - | - | - |
| Discover Raw Audio Files | - | Uses | - | - | - | - | - |
| Verify and Deduplicate Sources | - | Uses | - | - | - | - | - |
| Transcribe Audio via External ASR | - | - | Uses | - | - | - | - |
| Review the Transcripts | - | - | - | Uses | - | - | - |
| Stage Transcriptions with Media Link | - | Uses | - | - | - | - | - |
| Cognitivize the Staged Transcripts | - | - | - | - | Uses | - | - |
| Bind Normalized Source to Target Entity | - | - | - | - | - | Uses | - |
| Validate Target Model | - | - | - | - | - | - | Uses |
| Record the Rejected Batch | Uses | - | - | - | - | - | - |

# NN matrices: work-artifacts matrix

| Work \ Artifact | Raw Audio Recordings Directory | Unprocessed Audio List | Verified Audio Ingestion Queue | Raw Transcript and Subtitles | Staged Source Import Files | Cognitivized Transcript Sources | Updated Domain Model | Verified Target Domain Model | Rejected Batch Note |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Transcribe Audio Sources | Reviews | - | - | - | - | - | - | Creates | - |
| Discover Raw Audio Files | Reviews | Creates | - | - | - | - | - | - | - |
| Verify and Deduplicate Sources | - | Reviews | Creates | - | - | - | - | - | - |
| Transcribe Audio via External ASR | - | - | Reviews | Creates | - | - | - | - | - |
| Review the Transcripts | - | - | - | Reviews | - | - | - | - | - |
| Stage Transcriptions with Media Link | - | - | - | Reviews | Creates | - | - | - | - |
| Cognitivize the Staged Transcripts | - | - | - | - | Reviews | Creates | - | - | - |
| Bind Normalized Source to Target Entity | - | - | - | - | - | Reviews | Modifies | - | - |
| Validate Target Model | - | - | - | - | - | - | Validates | Creates | - |
| Record the Rejected Batch | - | - | - | Reviews | - | - | - | - | Creates |
