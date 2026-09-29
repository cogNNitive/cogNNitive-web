import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const VOCAB_JSON_PATH = path.join(REPO_ROOT, 'iNNfo', 'specs', 'vocabulary.json');
const VOCAB_MD_PATH = path.join(REPO_ROOT, 'docs', 'innfo', 'documentation', 'vocabulary.md');

export function renderVocabularyDoc(vocab) {
  const lines = [];

  lines.push('# Vocabulary: Canonical Terms');
  lines.push('');
  lines.push('The cogNNitive ecosystem pins a canonical vocabulary so every editor label, doc, and');
  lines.push('skill refers to the same concept by the same name. The authoritative source is the');
  lines.push('machine-readable dictionary at');
  lines.push('[`iNNfo/specs/vocabulary.json`](https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/specs/vocabulary.json);');
  lines.push('this page is the human-readable rendering of it.');
  lines.push('');
  lines.push('## Level Hierarchy & Canonical Terms');
  lines.push('');
  lines.push('| Level | Canonical Term | Deprecated / Former Aliases | Sense |');
  lines.push('|---|---|---|---|');

  for (const [termKey, term] of Object.entries(vocab.terms)) {
    const levelStr = term.level !== undefined ? `Level ${term.level}` : 'Ecosystem / Role';
    const aliasesStr = Array.isArray(term.aliases) && term.aliases.length > 0 ? term.aliases.map(a => `\`${a}\``).join(', ') : '*(none)*';
    lines.push(`| ${levelStr} | **${termKey}** | ${aliasesStr} | ${term.sense} |`);
  }
  lines.push('');

  lines.push('## Level Terms Detail');
  lines.push('');
  for (const [termKey, term] of Object.entries(vocab.terms)) {
    lines.push(`### **${termKey}**`);
    lines.push('');
    lines.push(`- **Sense**: ${term.sense}`);
    if (term.aliases && term.aliases.length > 0) {
      lines.push(`- **Deprecated Aliases**: ${term.aliases.map(a => `\`${a}\``).join(', ')}`);
    }
    if (term.uncountable) {
      lines.push(`- **Grammar Rule**: Uncountable noun. Written as \`${term.plural_rule || 'N ' + termKey + ' documents'}\`.`);
    }
    if (term.distinct_senses && term.distinct_senses.length > 0) {
      lines.push(`- **Distinct Senses**: ${term.distinct_senses.map(s => `"${s}"`).join(', ')}`);
    }
    if (term.self_knowledge_relation) {
      lines.push(`- **Container Nature**: A domaiNN is itself a kNNowledge document containing other documents.`);
    }
    if (term.excludes && term.excludes.length > 0) {
      lines.push(`- **Excluded Senses** (not renamed): ${term.excludes.map(e => `\`${e}\``).join(', ')}`);
    }
    lines.push('');
  }

  if (Array.isArray(vocab.retired_identifiers) && vocab.retired_identifiers.length > 0) {
    lines.push('## Retired Identifiers (Documentation Only)');
    lines.push('');
    lines.push('The following table lists retired identifiers and their canonical replacements.');
    lines.push('This mapping is documentation-only; no runtime aliases exist.');
    lines.push('');
    lines.push('| Old Identifier / Name | Canonical Replacement | Kind | Notes |');
    lines.push('|---|---|---|---|');
    for (const item of vocab.retired_identifiers) {
      lines.push(`| \`${item.old}\` | \`${item.new}\` | ${item.kind} | ${item.notes} |`);
    }
    lines.push('');
  }

  lines.push('## Consumer Notes');
  lines.push('');
  lines.push('- **Editor labels**: read `vocabulary.json` (read-only) to drive user-facing copy.');
  lines.push('- **Skill copy**: references the same dictionary for consistency.');
  lines.push('- **Agent Ubiquitous Language**: `AGENTS.md` points to this dictionary and vocabulary page.');
  lines.push('');

  return lines.join('\n');
}

export function syncVocabularyDoc(options = {}) {
  const { check = false } = options;
  if (!fs.existsSync(VOCAB_JSON_PATH)) {
    throw new Error(`vocabulary.json not found at ${VOCAB_JSON_PATH}`);
  }

  const rawJson = fs.readFileSync(VOCAB_JSON_PATH, 'utf8');
  const vocab = JSON.parse(rawJson);
  const rendered = renderVocabularyDoc(vocab);

  if (check) {
    if (!fs.existsSync(VOCAB_MD_PATH)) {
      console.error(`FAIL: vocabulary.md missing at ${VOCAB_MD_PATH}`);
      return false;
    }
    const current = fs.readFileSync(VOCAB_MD_PATH, 'utf8');
    if (current.replace(/\r\n/g, '\n') !== rendered.replace(/\r\n/g, '\n')) {
      console.error(`FAIL: vocabulary.md is out of sync with vocabulary.json. Run node scripts/generate-vocabulary-doc.mjs`);
      return false;
    }
    console.log(`OK: vocabulary.md is in sync with vocabulary.json`);
    return true;
  }

  fs.mkdirSync(path.dirname(VOCAB_MD_PATH), { recursive: true });
  fs.writeFileSync(VOCAB_MD_PATH, rendered, 'utf8');
  console.log(`OK: Generated ${VOCAB_MD_PATH} from vocabulary.json`);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const ok = syncVocabularyDoc({ check });
  process.exit(ok ? 0 : 1);
}
