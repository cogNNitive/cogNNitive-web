# Sample ActioNN: Paper to YouTube Script

Use the **nn-trannsform** skill to turn a scientific paper into a YouTube video script.

The sample uses **"When Zombies Attack!: Mathematical Modelling of an Outbreak of Zombie Infection"** by Munz et al. (2009) — a paper that applies SIR epidemiological models to zombie outbreaks.

## How to run

1. Place the PDF in `traNNsform/input/`
2. Activate the nn-trannsform skill
3. Say:

> Run the sample workflow paper-to-youtube on `traNNsform/input/munz2009a.pdf`. Read the paper, extract its core narrative, and produce a YouTube video script in `traNNsform/output/`. Include: hook, model breakdown for a general audience, key findings with analogies, limitations, and a call to action. Name the file `munz2009a_youtube_script.md`.

## Example

```bash
# Download the paper
curl -o traNNsform/input/munz2009a.pdf \
  https://pdodds.w3.uvm.edu/files/papers/others/2009/munz2009a.pdf

# Then tell your agent:
# "Run paper-to-youtube on traNNsform/input/munz2009a.pdf"
```

## Output

A Markdown script with timestamps and visual cues:

```markdown
# YouTube Script: When Zombies Attack! — The Math Behind the Apocalypse

## Hook (0:00-0:15) — [Visual: zombie movie horde]
## Intro (0:15-0:45) — [Visual: SIR model compartments]
## The basic model (0:45-1:45) — [Visual: Susceptible → Infected → Zombie flow]
## Adding latency (1:45-2:45) — [Visual: SEIR with quarantine]
## Can we win? (2:45-4:00) — [Visual: eradication threshold graph]
## Limitations (4:00-4:30) — [Visual: "Romero zombies only" disclaimer]
## CTA (4:30-5:00) — [Visual: subscribe + paper link]
```
