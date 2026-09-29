import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

describe('Quarantine Boundary & Browser Safety (Task 5.9)', () => {
  it('detect.ts (browser entry for ./legacy) contains no node: or Node built-in imports', async () => {
    const detectPath = path.resolve(__dirname, '../../src/legacy/detect.ts')
    const content = await fs.readFile(detectPath, 'utf8')

    expect(content).not.toMatch(/from\s+['"]node:/)
    expect(content).not.toMatch(/from\s+['"]fs['"]/)
    expect(content).not.toMatch(/from\s+['"]path['"]/)
    expect(content).not.toMatch(/from\s+['"]crypto['"]/)
  })

  it('only allowed locations import from legacy quarantine module', async () => {
    const srcDir = path.resolve(__dirname, '../../src')
    const allowedSubstrings = [
      'src/legacy',
      'src\\legacy',
      'tests/legacy',
      'tests\\legacy',
    ]

    async function checkDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          // Check non-legacy dirs in src
          if (!fullPath.includes('legacy')) {
            await checkDir(fullPath)
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const code = await fs.readFile(fullPath, 'utf8')
          const hasLegacyImport =
            code.includes("from './legacy") ||
            code.includes('from "../legacy') ||
            code.includes('from "../../legacy') ||
            code.includes('@cognnitive/innfo-core/legacy')

          if (hasLegacyImport) {
            const isAllowed = allowedSubstrings.some((sub) => fullPath.includes(sub))
            expect(isAllowed, `Unauthorized import of legacy module in ${fullPath}`).toBe(true)
          }
        }
      }
    }

    await checkDir(srcDir)
  })
})
