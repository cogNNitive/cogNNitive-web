import { readFileSync } from 'node:fs'

const spec = readFileSync(new URL('../../../../spec_NN.md', import.meta.url), 'utf8')
const version = /^blueprint_version:\s*"(V_\d+-\d+-\d+)"/m.exec(spec)
if (!version) throw new Error('The coNNtent blueprint must declare its version')
export const BLUEPRINT_VERSION = version[1]
