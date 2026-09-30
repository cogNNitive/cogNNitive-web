import { describe, it, expect } from 'vitest';
import { parseKnowledge, serializeKnowledge, applyMutation } from '../src/index';

describe('generate_index mutation', () => {
  it('generates index using template taxonomy', () => {
    const md = `---
spec_version: "V_0-3-0"
title: "Test Model"
---
# NN ConceptA
## NN ConceptA: Element1

# NN ConceptC
## NN ConceptC: Element2
`;
    const model = parseKnowledge(md);
    
    // Template taxonomy has edges ConceptA -> ConceptB -> ConceptC
    const templateTaxonomy = [
      { parent: 'ConceptA', child: 'ConceptB' },
      { parent: 'ConceptB', child: 'ConceptC' }
    ];

    const result = applyMutation(model, 'generate_index', { taxonomy: templateTaxonomy });
    expect(result.success).toBe(true);

    expect(model.taxonomy).toContainEqual({ parent: '', child: 'ConceptA' });
    expect(model.taxonomy).toContainEqual({ parent: '', child: 'ConceptC' });
  });

  it('keeps nesting when parent and child are present', () => {
    const md = `---
spec_version: "V_0-3-0"
title: "Test Model"
---
# NN ConceptA
## NN ConceptA: Element1

# NN ConceptB
## NN ConceptB: Element2
`;
    const model = parseKnowledge(md);
    const templateTaxonomy = [
      { parent: 'ConceptA', child: 'ConceptB' }
    ];

    const result = applyMutation(model, 'generate_index', { taxonomy: templateTaxonomy });
    expect(result.success).toBe(true);
    expect(model.taxonomy).toContainEqual({ parent: 'ConceptA', child: 'ConceptB' });
    expect(model.taxonomy).toContainEqual({ parent: '', child: 'ConceptA' }); // ConceptA has no parent
  });
});
