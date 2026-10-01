# Sample ActioNN: Meeting Notes to Executive Summary

Use the **nn-trannsform** skill to turn a YouTube video transcript into a stakeholder-ready executive summary.

The sample uses the transcript of the **"Better Off Ted — Let's Do It"** scene ([YouTube](https://www.youtube.com/watch?v=NeFafCEqeh0)).

## How to run

1. The sample transcript is at `traNNsform/input/better-off-ted-lets-do-it_source_NN.md`
2. Activate the nn-trannsform skill
3. Say:

> Run the sample workflow meeting-to-summary on `traNNsform/input/better-off-ted-lets-do-it_source_NN.md`. Read the transcript, extract decisions, action items, and blockers, and produce an executive summary in `traNNsform/output/`. Name the file `BetterOffTed_executive_summary.md`.

## Example

```bash
# The sample is already in place — just run the prompt above

# Replace with your own transcript:
# cp ~/Downloads/my-meeting-transcript.txt input/
# Then: "Run meeting-to-summary on input/my-meeting-transcript.txt"
```

## Output

A structured Markdown file:

```markdown
# Better Off Ted — Executive Summary
**Source**: https://www.youtube.com/watch?v=NeFafCEqeh0 | **Duration**: 0:56

## Executive Brief
Phil presented the Viridian solar-powered oven project. While the team has made progress on a military contract to airdrop ovens as a goodwill gesture, a critical safety issue was identified: the plastic casing leeches toxins into food when exposed to sunlight — which is the only condition under which solar ovens function.

## Decisions
- Proceed with fixing the toxicity issue rather than scrapping the project

## Action Items
| Owner | Task | Deadline |
|-------|------|----------|
| @phil | Investigate non-toxic materials for the oven casing | TBD |

## Blockers
- Fundamental conflict: sunlight triggers both the oven function and the toxin release

## Next Meeting
- Review material alternatives and toxicity test results
```
