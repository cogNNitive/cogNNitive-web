import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseModel, validateModel, resolveTemplateSchema } from '../src/index.js';

describe('User Workspace Refactorization (fixtures/simulacro-refactorizacion)', () => {
  const fixtureRoot = path.join(__dirname, 'fixtures/simulacro-refactorizacion');
  const wsPath = path.join(fixtureRoot, 'domaiNN_NN.md');
  const modelPath = path.join(fixtureRoot, 'kNNowledge/solaris_business_NN.md');
  const tplPath = path.join(fixtureRoot, 'bluepriNNts/business/spec_NN.md');
  const skillPath = path.join(fixtureRoot, 'skills/nn-innfo/SKILL.md');

  it('1. verifies that all required workspace and package files exist', () => {
    expect(fs.existsSync(wsPath)).toBe(true);
    expect(fs.existsSync(modelPath)).toBe(true);
    expect(fs.existsSync(tplPath)).toBe(true);
    expect(fs.existsSync(skillPath)).toBe(true);

    // Verify the modular package structure that git can actually carry. Git does
    // not store empty directories, so sub-package dirs which exist only as empty
    // skeletons (every skills/, plus business-model and repository procedures and
    // assets) are absent from a fresh checkout and must not be asserted here.
    // spec_NN.md and a populated samples/ are the invariants every template
    // package in this fixture holds.
    const templates = ['business', 'business-model', 'analysis', 'organization', 'projects', 'metrics', 'repository'];
    for (const t of templates) {
      const tDir = path.join(fixtureRoot, 'bluepriNNts', t);
      expect(fs.existsSync(path.join(tDir, 'spec_NN.md')), `Missing spec_NN.md in ${t}`).toBe(true);
      expect(fs.existsSync(path.join(tDir, 'samples')), `Missing samples in ${t}`).toBe(true);
    }
  });

  it('2. parses workspace_NN.md correctly as Level 3 workspace entrypoint', () => {
    const wsContent = fs.readFileSync(wsPath, 'utf8');
    const parsed = parseModel(wsContent);
    expect(parsed.frontmatter?.level).toBe(3);
    expect(parsed.frontmatter?.title).toBe('Solaris Technologies Workspace');
    expect(parsed.elements.has('Templates')).toBe(true);
    expect(parsed.elements.has('Models')).toBe(true);
    expect(parsed.elements.has('Skills')).toBe(true);
  });

  it('3. parses the user domain model conforming to the local business template', () => {
    const modelContent = fs.readFileSync(modelPath, 'utf8');
    const parsed = parseModel(modelContent);
    expect(parsed.frontmatter?.level).toBe(3);
    expect(parsed.frontmatter?.title).toBe('Solaris Core Business Model');
    expect(parsed.elements.has('Stakeholders')).toBe(true);

    const tplContent = fs.readFileSync(tplPath, 'utf8');
    const template = parseModel(tplContent);

    const resolveInclude = (inc: { name: string }) => {
      const p = path.join(fixtureRoot, 'bluepriNNts', inc.name, 'spec_NN.md');
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    };

    const { schema } = resolveTemplateSchema(tplContent, resolveInclude);
    console.log('Available template concepts:', schema.concepts.map(c => c.name).slice(0, 10));

    const result = validateModel(parsed, template, null, { resolveInclude });
    if (!result.valid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('4. confirms the local agent skill has valid YAML frontmatter', () => {
    const skillContent = fs.readFileSync(skillPath, 'utf8');
    expect(skillContent.startsWith('---')).toBe(true);
    expect(skillContent).toContain('name: nn-innfo');
  });
});
