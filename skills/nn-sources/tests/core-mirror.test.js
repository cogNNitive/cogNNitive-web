const test = require('../test/unit/test-core-mirror');
module.exports = test;
if (require.main === module) {
  const { passed, failed } = test.run();
  console.log(`\nCore-mirror tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
