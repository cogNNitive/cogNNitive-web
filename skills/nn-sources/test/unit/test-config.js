const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_DIR = path.resolve(__dirname, '..', '..');

// Mock config module by manipulating CONFIG_FILE_PATH
// We test via the module's interface by using a temp dir
const CONFIG_FILE_PATH = path.join(SKILL_DIR, 'config.json');

function run() {
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, msg) {
    try {
      assert.strictEqual(actual, expected);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      console.log(`    Expected: ${JSON.stringify(expected)}`);
      console.log(`    Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  function assertTrue(actual, msg) {
    assertEqual(actual, true, msg);
  }

  // Save original config and restore after
  const origConfig = fs.existsSync(CONFIG_FILE_PATH)
    ? fs.readFileSync(CONFIG_FILE_PATH, 'utf8')
    : null;

  // Clean up test config after
  function cleanup() {
    if (origConfig !== null) {
      fs.writeFileSync(CONFIG_FILE_PATH, origConfig, 'utf8');
    } else if (fs.existsSync(CONFIG_FILE_PATH)) {
      fs.unlinkSync(CONFIG_FILE_PATH);
    }
  }

  try {
    // Reload fresh module for each test
    delete require.cache[require.resolve('../../scripts/config')];
    const config = require('../../scripts/config');

    // Test 1: Default config returns empty object
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      fs.unlinkSync(CONFIG_FILE_PATH);
    }
    delete require.cache[require.resolve('../../scripts/config')];
    const config1 = require('../../scripts/config');
    const cfg = config1.getConfig();
    assertEqual(typeof cfg, 'object', 'getConfig returns object when no config file');
    assertEqual(Object.keys(cfg).length, 0, 'getConfig returns empty object when no config file');

    // Test 2: getDefaultPath returns Documents/traNNsform when no config
    const defaultPath = config1.getDefaultPath();
    assertTrue(defaultPath.endsWith(path.join('Documents', 'traNNsform')), 'getDefaultPath returns default path');

    // Test 3: saveConfig writes to file
    const result = config1.saveConfig({ defaultPath: '/tmp/test-trannsform' });
    assertTrue(result, 'saveConfig returns true on success');

    // Test 4: getConfig reads saved values
    delete require.cache[require.resolve('../../scripts/config')];
    const config2 = require('../../scripts/config');
    const cfg2 = config2.getConfig();
    assertEqual(cfg2.defaultPath, '/tmp/test-trannsform', 'getConfig reads saved defaultPath');

    // Test 5: getDefaultPath returns saved path
    const dp = config2.getDefaultPath();
    assertEqual(dp, '/tmp/test-trannsform', 'getDefaultPath returns saved path');

    // Test 6: saveConfig merges, not replaces
    config2.saveConfig({ lastProjectPath: '/tmp/test-trannsform/my-project' });
    delete require.cache[require.resolve('../../scripts/config')];
    const config3 = require('../../scripts/config');
    const cfg3 = config3.getConfig();
    assertEqual(cfg3.defaultPath, '/tmp/test-trannsform', 'saveConfig merges: defaultPath preserved');
    assertEqual(cfg3.lastProjectPath, '/tmp/test-trannsform/my-project', 'saveConfig merges: lastProjectPath added');

    cleanup();
    console.log(`\n  Config tests: ${passed} passed, ${failed} failed`);
  } catch (e) {
    cleanup();
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}
