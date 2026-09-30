/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import rules from '../../rules/index.js'

export function getFlatDefinitions(allProps: Record<string, any>): Record<string, any> {
  return { ...allProps }
}
