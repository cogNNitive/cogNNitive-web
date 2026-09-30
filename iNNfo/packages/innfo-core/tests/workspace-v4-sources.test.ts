import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseKnowledge, validateKnowledge } from '../src/index.js';

describe('Workspace Template V_0-4-0 & Polymorphic Sources', () => {
  const specPath = path.resolve(__dirname, '../../../specs/bluepriNNts/workspace_spec_NN.md');

  it('parses the workspace_spec_NN.md template correctly', () => {
    const specContent = fs.readFileSync(specPath, 'utf8');
    const parsed = parseKnowledge(specContent);
    expect(parsed.frontmatter?.template_version).toMatch(/^V_0-[4-6]-\d+$/);
    expect(parsed.elements.has('Concept Definition')).toBe(true);
    expect(parsed.elements.has('Field Definition')).toBe(true);
  });

  it('validates a Level 3 workspace model with polymorphic sources without syntax errors', () => {
    const sampleWorkspace = `---
level: 3
parent_spec:
  name: "workspace_spec"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Test Polymorphic Workspace"
---

# NN index

* [[Workspace]]
* [[Models]]
* [[Sources]]
* [[Procedures]]
* [[Artifacts]]
* [[Tag]]

# NN Workspace
models_dir:: kNNowledge/
sources_dir:: sources/nn/

Test workspace demonstrating polymorphic sources.

# NN Models

## NN Models: Operations Model
path:: kNNowledge/Operations_V_0-1-0_business_NN.md
template:: business_V_0-1-0
status:: active
author:: Lead Architect
derived_from:: [[Entrevista Operaciones]]

# NN Sources

## NN Sources: Entrevista Operaciones
type:: local_file
origin_uri:: sources/original/docs/interview.txt
format:: txt
subpath:: docs/interview.md
refresh_policy:: immutable
status:: ready
tags:: [operaciones, interno]

## NN Sources: Regulacion Oficial
type:: url_snapshot
origin_uri:: https://cnv.gob.ar/normativas/resolucion-2026-890.html
format:: html
subpath:: web/regulation-2026.md
refresh_policy:: manual
status:: ready
tags:: [compliance, externo]
`;

    const parsed = parseKnowledge(sampleWorkspace);
    expect(parsed.frontmatter?.title).toBe('Test Polymorphic Workspace');
    expect(parsed.elements.get('Sources')?.length).toBe(2);

    const sources = parsed.elements.get('Sources')!;
    const s1 = sources.find(s => s.name === 'Entrevista Operaciones');
    expect(s1?.fields.type).toBe('local_file');
    expect(s1?.fields.subpath).toBe('docs/interview.md');

    const s2 = sources.find(s => s.name === 'Regulacion Oficial');
    expect(s2?.fields.type).toBe('url_snapshot');
    expect(s2?.fields.origin_uri).toBe('https://cnv.gob.ar/normativas/resolucion-2026-890.html');

    const specContent = fs.readFileSync(specPath, 'utf8');
    const templateDoc = {
      name: 'workspace_spec',
      level: 2 as const,
      parentName: 'iNNfo_V_0-2-1',
      frontmatter: {
        spec_version: 'V_0-2-1',
        spec_url: 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md',
        level: 2 as const,
        relationship_types: {},
      },
      rawContent: specContent,
    };

    const result = validateKnowledge(parsed, templateDoc, null);
    if (!result.valid) console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
