#!/usr/bin/env node

/**
 * scripts/verify-inventory.test.js
 *
 * Plain-node tests for Template Inventory Guard in scripts/verify.js.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { checkBlueprintInventory } = require('./verify.js');

function main() {
  console.log('Running verify-inventory unit tests...');

  // 1. Skill/mcp/workflow name colliding with unregistered template folder fails guard
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-inventory-'));
    try {
      const sourceYaml = `---
skills:
  - name: colliding-skill
    path: actioNN/skills/colliding-skill
blueprints:
  - name: registered-tmpl
    path: iNNfo/specs/templates/registered-tmpl
`;
      const sourceYamlPath = path.join(tmpDir, 'source.yaml');
      fs.writeFileSync(sourceYamlPath, sourceYaml, 'utf8');

      const blueprintsDir = path.join(tmpDir, 'templates');
      fs.mkdirSync(path.join(blueprintsDir, 'registered-tmpl'), { recursive: true });
      fs.mkdirSync(path.join(blueprintsDir, 'colliding-skill'), { recursive: true });

      const result = checkBlueprintInventory(blueprintsDir, sourceYamlPath);
      assert.strictEqual(
        result.ok,
        false,
        'Template folder named after a skill must NOT be recognized as a declared template',
      );
      assert.deepStrictEqual(result.missing, ['colliding-skill']);
      console.log('✔ Non-template collision detection passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 2. Normal registered template passes guard
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-inventory-'));
    try {
      const sourceYaml = `---
blueprints:
  - name: registered-tmpl
    path: iNNfo/specs/templates/registered-tmpl
`;
      const sourceYamlPath = path.join(tmpDir, 'source.yaml');
      fs.writeFileSync(sourceYamlPath, sourceYaml, 'utf8');

      const blueprintsDir = path.join(tmpDir, 'templates');
      fs.mkdirSync(path.join(blueprintsDir, 'registered-tmpl'), { recursive: true });

      const result = checkBlueprintInventory(blueprintsDir, sourceYamlPath);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.missing, []);
      console.log('✔ Normal registered template passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 3. Folder declared only under frozen_blueprints: passes guard (frozen partition)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-inventory-'));
    try {
      const sourceYaml = `---
blueprints:
  - name: registered-tmpl
    path: iNNfo/specs/templates/registered-tmpl
frozen_blueprints:
  - name: cogNNitive
    path: iNNfo/specs/templates/cogNNitive/cogNNitive_V_0-2-0_NN.md
    version: "V_0-2-1"
`;
      const sourceYamlPath = path.join(tmpDir, 'source.yaml');
      fs.writeFileSync(sourceYamlPath, sourceYaml, 'utf8');

      const blueprintsDir = path.join(tmpDir, 'templates');
      fs.mkdirSync(path.join(blueprintsDir, 'registered-tmpl'), { recursive: true });
      fs.mkdirSync(path.join(blueprintsDir, 'cogNNitive'), { recursive: true });

      const result = checkBlueprintInventory(blueprintsDir, sourceYamlPath);
      assert.strictEqual(
        result.ok,
        true,
        'frozen-only folder must satisfy the inventory guard via the frozen_blueprints: partition',
      );
      assert.deepStrictEqual(result.missing, []);
      console.log('✔ Frozen-only folder passed via frozen_blueprints: partition');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 4. Folder declared only under seam_dirs: passes guard (shared seam partition)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-inventory-'));
    try {
      const sourceYaml = `---
blueprints:
  - name: registered-tmpl
    path: iNNfo/specs/templates/registered-tmpl
seam_dirs:
  - name: console
    path: iNNfo/specs/templates/console/
    description: Shared console seam.
`;
      const sourceYamlPath = path.join(tmpDir, 'source.yaml');
      fs.writeFileSync(sourceYamlPath, sourceYaml, 'utf8');

      const blueprintsDir = path.join(tmpDir, 'templates');
      fs.mkdirSync(path.join(blueprintsDir, 'registered-tmpl'), { recursive: true });
      fs.mkdirSync(path.join(blueprintsDir, 'console'), { recursive: true });

      const result = checkBlueprintInventory(blueprintsDir, sourceYamlPath);
      assert.strictEqual(
        result.ok,
        true,
        'seam folder must satisfy the inventory guard via the seam_dirs: partition',
      );
      assert.deepStrictEqual(result.missing, []);
      console.log('✔ Seam-only folder passed via seam_dirs: partition');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log('All verify-inventory unit tests passed successfully!');
}

main();
