/**
 * nn-conntent/test/procedures.test.mjs
 *
 * Guard for the coNNtent procedures: `procedures/usage_procedures_NN.md` is a walkthrough
 * whose six steps each `call::` one procedure document (Set up the Domain ... Produce an
 * Episode). Every step of those documents declares its `executor` from the closed set and the
 * field that carries its contribution, there is no Deliver procedure, the setup procedures end
 * in a sealed proposed changeset, Create a Series ends in a dry run, and Plan an Episode reads
 * CHARACTER.md prose.
 *
 * Each document holds one `## NN Procedure:` header with its steps nested under it as
 * `### NN Work:`, ordered by `next::`, an address (`@<slug>`), the one form
 * `validate_knowledge` accepts for a typed reference field (procedure-reference-form).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROCEDURES_DIR = path.resolve(here, '..', '..', '..', 'procedures');
const read = (file) => fs.readFileSync(path.join(PROCEDURES_DIR, file), 'utf8');

const SIX = [
  'Set up the Domain',
  'Define a Frame',
  'Define a Character',
  'Create a Series',
  'Plan an Episode',
  'Produce an Episode',
];

const SETUP = ['Set up the Domain', 'Define a Frame', 'Define a Character', 'Create a Series'];

const EXECUTORS = new Set(['agent', 'engine', 'human']);

/** The fields that carry what each executor contributes ("declare its contribution"). */
const EXECUTOR_FIELDS = {
  agent: ['produces'],
  engine: ['command'],
  human: ['decision', 'section'],
};

/** Console sections registered by `conntent-domain-console` (task 4c.1). */
const CONSOLE_SECTION_RE = /^(Domain|Series|Episode) > [A-Z][\w ]+$/;

const ELEMENT_RE = /^#{2,6}\s+NN\s+([^:]+):\s*(.+?)\s*$/;
const FIELD_RE = /^([a-z_]+)::\s*(.*)$/;

/**
 * The slug an address names. A typed reference field carries one form: `@<slug>`
 * inside the document. The `@` is the document itself, not part of the slug.
 */
const addressSlug = (value) => String(value || '').trim().replace(/^@+/, '').trim();

/** Parses one document into its elements; `lines` keeps the raw body. */
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
  return elements;
}

const usage = parseDocument(read('usage_procedures_NN.md'));
const calls = usage.filter((element) => element.concept === 'Work').map((step) => step.fields.call);
/** One entry per called document: its header (the procedure) and its steps. */
const documents = calls.map((file) => {
  const source = read(file);
  const elements = parseDocument(source);
  return {
    file,
    source,
    elements,
    header: elements.find((element) => element.concept === 'Procedure'),
    steps: elements.filter((element) => element.concept === 'Work'),
  };
});
const procedures = documents.map((doc) => doc.header);
const procedureNames = procedures.map((element) => element.name);
const stepsOf = (procedure) => documents.find((doc) => doc.header === procedure).steps;
const allSteps = documents.flatMap((doc) => doc.steps);
const text = [read('usage_procedures_NN.md'), ...documents.map((doc) => doc.source)].join('\n');

const body = (element) => element.lines.join('\n');
/** A procedure's own fields and prose plus every step body, in order. */
const allText = (procedure) => [body(procedure), ...stepsOf(procedure).map(body)].join('\n');
const executorOf = (step) => step.fields.executor || 'agent';

test('the usage guide calls exactly the six procedures, in order, and nothing else', () => {
  assert.deepEqual(procedureNames, SIX);
  for (const file of calls) assert.match(file, /^[a-z_]+_procedures_NN\.md$/);
});

test('every procedure document holds one header and declares the slug of every step', () => {
  for (const doc of documents) {
    assert.equal(
      doc.elements.filter((element) => element.concept === 'Procedure').length,
      1,
      `${doc.file} must hold exactly one Procedure header`,
    );
    assert.ok(doc.header.fields.slug, `procedure "${doc.header.name}" declares no slug::`);
    assert.ok(doc.steps.length > 0, `procedure "${doc.header.name}" has no steps`);
    for (const step of doc.steps) assert.ok(step.fields.slug, `step "${step.name}" has no slug::`);
  }
});

test('next:: and output:: carry an address, never a wikilink', () => {
  // `procedure-reference-form`: one accepted form. `validate_knowledge` rejects
  // `[[Name]]` with ADDRESS_MALFORMED, so nothing here may still write it.
  for (const doc of documents) {
    const declaredSlugs = new Set(
      doc.elements.map((element) => element.fields.slug).filter((slug) => Boolean(slug)),
    );
    for (const element of [doc.header, ...doc.steps]) {
      for (const field of ['next', 'output']) {
        const value = element.fields[field];
        if (!value) continue;
        assert.doesNotMatch(
          value,
          /\[\[|\]\]/,
          `"${element.name}" writes the removed wikilink form in ${field}:: ${value}`,
        );
        assert.match(value, /^@/, `"${element.name}" must write ${field}:: as @<slug>, got "${value}"`);
        assert.ok(
          declaredSlugs.has(addressSlug(value)),
          `"${element.name}" addresses ${field}:: ${value}, which is not a slug:: declared in ${doc.file}`,
        );
      }
    }
  }
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
    for (const field of ['level', 'outputs_expected']) {
      assert.ok(
        procedure.fields[field] && procedure.fields[field].length > 0,
        `procedure "${procedure.name}" has no ${field}::`,
      );
    }
    assert.match(body(procedure), /It starts when: /, `procedure "${procedure.name}" states no precondition`);
  }
});

test('every step declares its executor from the closed set, never through tool', () => {
  assert.ok(allSteps.length > 0, 'no steps found: every procedure needs steps');
  for (const step of allSteps) {
    const declarations = step.lines.filter((line) => /^executor::/.test(line));
    assert.equal(declarations.length, 1, `step "${step.name}" must declare exactly one executor::`);
    assert.ok(EXECUTORS.has(executorOf(step)), `step "${step.name}" declares executor "${executorOf(step)}"`);
    assert.doesNotMatch(
      step.fields.tool || '',
      /^(agent|engine|human|console)$/,
      `step "${step.name}" still names its executor through tool::`,
    );
  }
});

test('every executor in the closed set is used at least once', () => {
  const used = new Set(allSteps.map(executorOf));
  for (const executor of EXECUTORS) assert.ok(used.has(executor), `no step uses executor "${executor}"`);
});

test('each step states what its executor contributes', () => {
  for (const step of allSteps) {
    const fields = EXECUTOR_FIELDS[executorOf(step)];
    assert.ok(
      fields.some((field) => step.fields[field] && step.fields[field].length > 0),
      `step "${step.name}" (executor ${executorOf(step)}) has none of ${fields.join(', ')}::`,
    );
  }
});

test('every console step names a registered console section', () => {
  for (const step of allSteps.filter((element) => element.fields.section)) {
    assert.match(
      step.fields.section || '',
      CONSOLE_SECTION_RE,
      `console step "${step.name}" must name a section such as "Episode > Review"`,
    );
  }
});

test('every engine command points at the installed skill and a script', () => {
  for (const step of allSteps.filter((element) => executorOf(element) === 'engine')) {
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
    assert.equal(executorOf(last), 'human', `setup procedure "${name}" must end in a human step`);

    const proposals = steps.filter((step) => /writeProposedChangeset/.test(body(step)));
    assert.ok(proposals.length > 0, `setup procedure "${name}" never delivers a sealed proposed changeset`);
    for (const proposal of proposals) {
      assert.equal(executorOf(proposal), 'agent', `the changeset writer in "${name}" must be the agent`);
      assert.match(body(proposal), /proposed/i);
    }

    assert.ok(
      steps.some((step) => executorOf(step) === 'human' && /approv/i.test(body(step))),
      `setup procedure "${name}" has no human approval step`,
    );

    for (const step of steps) {
      if (executorOf(step) !== 'agent') continue;
      assert.doesNotMatch(body(step), /apply (this|the) (sealed )?changeset/i, `agent applies the changeset in "${name}"`);
    }
  }
});

test('Create a Series ends with a dry-run test episode kept or discarded by the human', () => {
  const procedure = procedures.find((element) => element.name === 'Create a Series');
  const steps = stepsOf(procedure);

  // The test episode is created inside the run, so its path is not a run parameter: the agent
  // runs the dry run on the episode the applied proposal created.
  const dryRun = steps.find((step) => executorOf(step) === 'agent' && /dry run/i.test(body(step)));
  assert.ok(dryRun, 'Create a Series has no agent dry-run step');
  assert.match(body(dryRun), /scripts\/produce\.mjs\b[^\n]*--dry-run\b/, 'the dry run does not name produce --dry-run');
  assert.match(allText(procedure), /no spend|spends nothing|nothing is spent/i, 'the dry run does not state that it spends nothing');

  const choice = steps.find((step) => executorOf(step) === 'human' && /keep/i.test(body(step)) && /discard/i.test(body(step)));
  assert.ok(choice, 'no human keep-or-discard step');

  const last = steps.at(-1);
  assert.equal(executorOf(last), 'human', 'the keep-or-discard choice must be the last step');
  assert.match(allText(procedure), /first episode/i, 'keeping must make the test episode the first episode');
});

test('voices are cloned by the agent, once per voice the person chose, each with its language', () => {
  // Names, samples and languages are decided inside the run, one per language, so no engine
  // command can take them as run parameters.
  for (const name of ['Set up the Domain', 'Define a Character']) {
    const procedure = procedures.find((element) => element.name === name);
    const clones = stepsOf(procedure).filter((step) => /voice-clone\.mjs/.test(body(step)));
    assert.equal(clones.length, 1, `${name} has no single voice-clone step`);
    const [clone] = clones;
    assert.equal(executorOf(clone), 'agent', `${name} clones voices outside the agent`);
    assert.match(body(clone), /scripts\/voice-clone\.mjs\b[^\n]*--language\b/, `${name} clones without a language`);
    assert.match(body(clone), /each (chosen )?voice|once per voice|for every voice/i, `${name} does not clone per voice`);
  }
});

test('Plan an Episode reads CHARACTER.md prose before writing narration', () => {
  const procedure = procedures.find((element) => element.name === 'Plan an Episode');
  const steps = stepsOf(procedure);
  const reads = steps.filter((step) => /CHARACTER\.md/.test(body(step)) && /prose/i.test(body(step)));
  assert.ok(reads.length > 0, 'Plan an Episode never reads the character prose');
  assert.equal(executorOf(reads[0]), 'agent', 'the character prose is read by the agent');
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
  const engineSteps = steps.filter((step) => executorOf(step) === 'engine');
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
      executorOf(step) === 'human',
      `step "${step.name}" approves a gate with executor "${executorOf(step)}"`,
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
