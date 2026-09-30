// Unit tests for checkMinVersion (manifest MCP `min_version` rule).
const assert = require('node:assert')
const { checkMinVersion, compareSemver } = require('./manifest-rules.js')

// absent min_version is allowed
assert.strictEqual(checkMinVersion({ name: 'm', version: '0.12.0' }), null)

// equal to the pinned version is allowed
assert.strictEqual(checkMinVersion({ name: 'm', version: '0.12.0', min_version: '0.12.0' }), null)

// below the pinned version is allowed
assert.strictEqual(checkMinVersion({ name: 'm', version: '0.12.0', min_version: '0.11.0' }), null)

// above the pinned version is rejected, naming the field
assert.ok(/exceeds the pinned version/.test(checkMinVersion({ name: 'm', version: '0.12.0', min_version: '0.13.0' })))

// non-semver is rejected
assert.ok(/not a valid semver/.test(checkMinVersion({ name: 'm', version: '0.12.0', min_version: 'abc' })))

// semver comparison
assert.strictEqual(compareSemver('0.12.0', '0.12.0'), 0)
assert.strictEqual(compareSemver('0.11.0', '0.12.0'), -1)
assert.strictEqual(compareSemver('0.13.0', '0.12.0'), 1)

console.log('✔ checkMinVersion tests passed (5 cases + semver)')
