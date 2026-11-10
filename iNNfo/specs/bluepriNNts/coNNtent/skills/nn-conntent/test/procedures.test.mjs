/**
 * nn-conntent/test/procedures.test.mjs
 *
 * Guard for the single coNNtent procedures document
 * (`procedures/usage_procedures_NN.md`): exactly six procedures, every step
 * declaring exactly one tool from the closed set, no Deliver procedure, the
 * setup procedures ending in a sealed proposed changeset, the Create a Series
 * dry run, and Plan an Episode reading CHARACTER.md prose.
 *
 * Capability `conntent-procedures` (tasks 5a.1-5a.5). The document is parsed
 * as the console procedure stepper reads it: `## NN Work:` elements whose
 * `parent::` field links a step to its procedure, with `next::` ordering the
 * chain inside that procedure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOC_PATH = path.resolve(here, '..', '..', '..', 'procedures', 'usage_procedures_NN.md');
const text = fs.readFileSync(DOC_PATH, 'utf8');

const SIX = [
  'Set up the Domain',
  'Define a Frame',
  'Define a Character',
  'Create a Series',
  'Plan an Episode',
  'Produce an Episode',
];

const SETUP = ['Set up the Domain', 'Define a Frame', 'Define a Character', 'Create a Series'];

const TOOLS = new Set(['agent', 'engine', 'console', 'human']);

/** The field each tool must fill to satisfy "declare its tool". */
const TOOL_FIELD = {
  agent: 'produces',
  engine: 'command',
  console: 'section',
  human: 'decision',
};

/** Console sections registered by `conntent-domain-console` (task 4c.1). */
const CONSOLE_SECTION_RE = /^(Domain|Series|Episode) > [A-Z][\w ]+$/;

const ELEMENT_RE = /^#{2,6}\s+NN\s+([^:]+):\s*(.+?)\s*$/;
const FIELD_RE = /^([a-z_]+)::\s*(.*)$/;

const stripRef = (value) => String(value || '').replace(/^\[\[/, '').replace(/\]\]$/, '').trim();

/**
 * Parses the document into the elements the console sees. `lines` keeps the raw
 * body so a duplicate `tool::` can be counted (the last value wins in `fields`).
 * @returns {{elements: Array<{concept: string, name: string, fields: Record<string,string>, lines: string[]}>}}
 */
function parseDocument(source) {
  const elements = [];
  let current = null;
  for (const raw of source.split(/\r?\n/)) {
    const heading = raw.match(ELEMENT_RE);
    if (heading) {
      current = { concept: heading[1].trim(), name: heading[2].trim(), fields: {}, lines: [] };
      elements.push(current);
      continue;
    }
    if (/^#\s/.test(raw)) {
      current = null;
      continue;
    }
    if (!current) continue;
    current.lines.push(raw);
    const field = raw.match(FIELD_RE);
    if (field) current.fields[field[1]] = field[2].trim();
  }
  return { elements };
}

const { elements } = parseDocument(text);
const work = elements.filter((element) => element.concept === 'Work');
const procedures = work.filter((element) => !element.fields.parent);
const procedureNames = procedures.map((element) => element.name);
const stepsOf = (procedure) =>
  work.filter((element) => element.fields.parent && stripRef(element.fields.parent) === procedure.name);
const allSteps = procedures.flatMap((procedure) => stepsOf(procedure));

const body = (element) => element.lines.join('\n');
/** A procedure's own fields and prose plus every step body, in order. */
const allText = (procedure) => [body(procedure), ...stepsOf(procedure).map(body)].join('\n');
const toolOf = (step) => (step.lines.find((line) => /^tool::/.test(line)) || '').replace(/^tool::\s*/, '').trim();

test('exactly the six procedures, in order, and nothing else', () => {
  assert.deepEqual(procedureNames, SIX);
  // "and nothing else": no other unparented Work element is a procedure.
  assert.equal(procedures.length, SIX.length);
});

test('the document does not define a Deliver procedure', () => {
  assert.equal(
    procedures.filter((procedure) => /^deliver/i.test(procedure.name)).length,
    0,
    'a Deliver procedure exists',
  );
});

test('the seven episode-only procedures are gone', () => {
  const retired = [
    'Draft the Episode',
    'Propose the Changeset',
    'Review the Episode',
    'Approve the Spend',
    'Produce the Master',
    'Finish the Publication',
  ];
  for (const phrase of retired) {
    assert.equal(text.toLowerCase().includes(phrase.toLowerCase()), false, `retired step is still present: ${phrase}`);
  }
});

test('every procedure states its level, its precondition and the artifact it ends in', () => {
  for (const procedure of procedures) {
    for (const field of ['level', 'condition', 'output']) {
      assert.ok(
        procedure.fields[field] && procedure.fields[field].length > 0,
        `procedure "${procedure.name}" has no ${field}::`,
      );
    }
  }
});

test('every step declares exactly one tool from the closed set', () => {
  assert.ok(allSteps.length > 0, 'no steps found: every procedure needs steps');
  for (const procedure of procedures) {
    assert.ok(stepsOf(procedure).length > 0, `procedure "${procedure.name}" has no steps`);
  }
  for (const step of allSteps) {
    const declarations = step.lines.filter((line) => /^tool::/.test(line));
    assert.equal(declarations.length, 1, `step "${step.name}" must declare exactly one tool::`);
    const tool = toolOf(step);
    assert.ok(TOOLS.has(tool), `step "${step.name}" declares tool "${tool}", outside the closed set`);
  }
});

test('every tool in the closed set is used at least once', () => {
  const used = new Set(allSteps.map(toolOf));
  for (const tool of TOOLS) assert.ok(used.has(tool), `no step uses tool "${tool}"`);
});

test('each step states what its tool contributes', () => {
  for (const step of allSteps) {
    const tool = toolOf(step);
    const field = TOOL_FIELD[tool];
    assert.ok(field, `step "${step.name}" has an unknown tool "${tool}"`);
    assert.ok(
      step.fields[field] && step.fields[field].length > 0,
      `step "${step.name}" (tool ${tool}) has no ${field}::`,
    );
  }
});

test('every console step names a registered console section', () => {
  for (const step of allSteps.filter((element) => toolOf(element) === 'console')) {
    assert.match(
      step.fields.section || '',
      CONSOLE_SECTION_RE,
      `console step "${step.name}" must name a section such as "Episode > Review"`,
    );
  }
});

test('every engine command points at the installed skill and a script', () => {
  for (const step of allSteps.filter((element) => toolOf(element) === 'engine')) {
    const command = step.fields.command || '';
    assert.match(command, /^~\/\.agents\/skills\/nn-conntent\/scripts\/[\w-]+\.mjs\b/, `step "${step.name}" does not use the installed skill path`);
  }
});

test('the whole document references the installed skill path, never a package-relative one', () => {
  const marker = 'skills/nn-conntent/scripts/';
  for (const match of text.matchAll(new RegExp(marker.replace(/[/]/g, '\\/'), 'g'))) {
    const before = text.slice(Math.max(0, match.index - '~/.agents/'.length), match.index);
    assert.equal(before, '~/.agents/', `bare skill path at offset ${match.index}: ${marker}`);
  }
});

test('setup procedures end in a sealed proposed changeset and a human approval', () => {
  for (const name of SETUP) {
    const procedure = procedures.find((element) => element.name === name);
    assert.ok(procedure, `missing setup procedure: ${name}`);
    const steps = stepsOf(procedure);

    const last = steps.at(-1);
    assert.ok(last, `setup procedure "${name}" has no steps`);
    assert.equal(toolOf(last), 'human', `setup procedure "${name}" must end in a human step`);

    const proposals = steps.filter((step) => /writeProposedChangeset/.test(body(step)));
    assert.ok(proposals.length > 0, `setup procedure "${name}" never delivers a sealed proposed changeset`);
    for (const proposal of proposals) {
      assert.equal(toolOf(proposal), 'agent', `the changeset writer in "${name}" must be the agent`);
      assert.match(body(proposal), /proposed/i);
    }

    assert.ok(
      steps.some((step) => toolOf(step) === 'human' && /approv/i.test(body(step))),
      `setup procedure "${name}" has no human approval step`,
    );

    for (const step of steps) {
      if (toolOf(step) !== 'agent') continue;
      assert.doesNotMatch(body(step), /apply (this|the) (sealed )?changeset/i, `agent applies the changeset in "${name}"`);
    }
  }
});

test('Create a Series ends with a dry-run test episode kept or discarded by the human', () => {
  const procedure = procedures.find((element) => element.name === 'Create a Series');
  const steps = stepsOf(procedure);

  const dryRun = steps.find((step) => toolOf(step) === 'engine' && /dry run/i.test(body(step)));
  assert.ok(dryRun, 'Create a Series has no engine dry-run step');
  assert.match(dryRun.fields.command || '', /--dry-run\b/, 'the dry run does not pass --dry-run');
  assert.match(allText(procedure), /no spend|spends nothing|nothing is spent/i, 'the dry run does not state that it spends nothing');

  const choice = steps.find((step) => toolOf(step) === 'human' && /keep/i.test(body(step)) && /discard/i.test(body(step)));
  assert.ok(choice, 'no human keep-or-discard step');

  const last = steps.at(-1);
  assert.equal(toolOf(last), 'human', 'the keep-or-discard choice must be the last step');
  assert.match(allText(procedure), /first episode/i, 'keeping must make the test episode the first episode');
});

test('Plan an Episode reads CHARACTER.md prose before writing narration', () => {
  const procedure = procedures.find((element) => element.name === 'Plan an Episode');
  const steps = stepsOf(procedure);
  const reads = steps.filter((step) => /CHARACTER\.md/.test(body(step)) && /prose/i.test(body(step)));
  assert.ok(reads.length > 0, 'Plan an Episode never reads the character prose');
  assert.equal(toolOf(reads[0]), 'agent', 'the character prose is read by the agent');
});

test('Plan an Episode verifies translation prerequisites and addresses one scene', () => {
  const procedure = procedures.find((element) => element.name === 'Plan an Episode');
  const procedureBody = allText(procedure);
  assert.match(procedureBody, /translation_of/);
  assert.match(procedureBody, /language/);
  assert.match(procedureBody, /scene/i);
  assert.match(procedureBody, /one scene|that scene only|the flagged scene/i);
});

test('Produce an Episode names produce as the only engine command', () => {
  const procedure = procedures.find((element) => element.name === 'Produce an Episode');
  const steps = stepsOf(procedure);
  const engineSteps = steps.filter((step) => toolOf(step) === 'engine');
  assert.ok(engineSteps.length > 0, 'Produce an Episode has no engine step');
  for (const step of engineSteps) {
    assert.match(step.fields.command || '', /\/scripts\/produce\.mjs\b/, `step "${step.name}" runs a command other than produce`);
    assert.doesNotMatch(step.fields.command || '', /\s--approve\b/, `step "${step.name}" approves a gate with a flag`);
  }
  assert.doesNotMatch(text, /--approve\b/, 'the document still mentions --approve');
});

test('Produce an Episode keeps every approval human or in the console', () => {
  const procedure = procedures.find((element) => element.name === 'Produce an Episode');
  for (const step of stepsOf(procedure)) {
    if (!/approv/i.test(body(step))) continue;
    assert.ok(
      ['console', 'human'].includes(toolOf(step)),
      `step "${step.name}" approves a gate with tool "${toolOf(step)}"`,
    );
  }
});

test('Produce an Episode describes delivery as the automatic outcome, not a step', () => {
  const procedure = procedures.find((element) => element.name === 'Produce an Episode');
  const steps = stepsOf(procedure);
  assert.equal(steps.filter((step) => /^deliver/i.test(step.name)).length, 0, 'delivery is modelled as a step');
  for (const step of steps) {
    assert.doesNotMatch(step.fields.command || '', /deliver/i, `step "${step.name}" runs a delivery command`);
  }
  assert.match(allText(procedure), /delivery is automatic/i);
  assert.match(allText(procedure), /delivered/);
});

test('Produce an Episode covers skip, budget, failure and re-open paths', () => {
  const procedure = procedures.find((element) => element.name === 'Produce an Episode');
  const procedureBody = allText(procedure);
  assert.match(procedureBody, /review_gates/);
  assert.match(procedureBody, /budget/);
  assert.match(procedureBody, /failed_qa/);
  assert.match(procedureBody, /Episode > Status/);
  assert.match(procedureBody, /re-open/i);
  assert.match(procedureBody, /review_gates:: \[\]/);
  assert.match(procedureBody, /no human step/i);
  assert.match(procedureBody, /delivered/);
});

test('no step instructs a hand edit of a kNNowledge document', () => {
  const handEdit = /(edit|modify|rewrite|change|write)\b[^\n]{0,80}\b_NN\.md\b[^\n]{0,80}\b(by hand|manually|directly)\b/i;
  for (const element of [...procedures, ...allSteps]) {
    assert.doesNotMatch(body(element), handEdit, `"${element.name}" instructs a hand edit`);
  }
});
