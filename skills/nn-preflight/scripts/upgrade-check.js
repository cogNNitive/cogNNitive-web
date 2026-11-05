#!/usr/bin/env node

/**
 * skills/nn-preflight/scripts/upgrade-check.js
 *
 * DEPRECATED shim. The lineage audit moved to `lineage-audit.js` (canonical name);
 * this file exists so an old invocation still resolves. It re-exports the module
 * unchanged and runs the same CLI.
 */

module.exports = require('./lineage-audit');

if (require.main === module) {
  require('./lineage-audit').main();
}
