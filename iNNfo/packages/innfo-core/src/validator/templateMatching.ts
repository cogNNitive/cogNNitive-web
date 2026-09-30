/**
 * Matches a resolved submodel/target template against an expected
 * `target_blueprint` value: exact name, exact url, url suffix variants
 * (`/<expected>`, `/<expected>.md`, `/<expected>_NN.md`), or name suffix.
 */
export function matchesTargetBlueprint(expectedTemplate: string, actual: { name?: string; url?: string }): boolean {
  const expected = expectedTemplate.trim().toLowerCase()
  const actualName = (actual.name ?? '').trim().toLowerCase()
  const actualUrl = (actual.url ?? '').trim().toLowerCase()
  return (
    actualName === expected ||
    actualUrl === expected ||
    actualUrl.endsWith(`/${expected}`) ||
    actualUrl.endsWith(`/${expected}.md`) ||
    actualUrl.endsWith(`/${expected}_NN.md`) ||
    actualName.endsWith(expected)
  )
}
