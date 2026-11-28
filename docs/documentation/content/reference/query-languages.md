# Query languages

A domaiNN can be asked a question two ways, and they answer **different** questions. Neither replaces the other: merging them was evaluated and rejected on 2026-11-16, and this page is the boundary that decision asked for.

## The two languages

| | Console filter | Address query |
|---|---|---|
| Lives in | `console/nn-runtime.js` (`parseFilterQuery`, `filterElements`) | `nn-core/src/queryUnits.ts` (`parseKnowledgeQuery`, `runQuery`) |
| Answers | **what to render** | **which units exist** |
| Syntax | free text, `key:value`, `field:name=value`, `\|` any-of, `OR`, parentheses, numeric comparisons | `path?field=value&field=value&projection` |
| Matching | a `select` field is exact; every other scalar matches by **substring** | literal equality after NFC normalisation, trim and case-folding |
| Combined with | depends on the facet: model and concept combine with OR, the rest with AND | always AND |
| UI state | folds drafts and reviewed status into the result | none |
| Returns | rendered cards | canonical `@` addresses |

## The rule

**Deterministic filtering belongs to nn-core. Search ergonomics belong to the console.**

- A reference, an MCP tool argument, a payload or an import filter uses the **address query**. It is the sibling of the `@` grammar and it resolves to addresses.
- A search box uses the **console filter**. Free-text search, the `OR` toggle, numeric comparisons and the draft/reviewed facets are presentation, not query.
- A new operator (`in`, comparisons) is added **once**, in nn-core under the reserved `op.` namespace, and the console reuses it. It is never added to the console first.
- When a console structured filter and `query_units` disagree on the same data, **the console is wrong**.

## Why they were not merged

A third grammar would have had to serve both, change the public `query_units` syntax and cost two to three sessions — for a divergence nobody has been bitten by. The boundary is cheaper, and it is what was missing.

The divergence is real, not theoretical: a non-`select` field `categoria` holding `AB` matches `categoria=A` in the console (substring) and does **not** match in `query_units` (equality). That is correct behaviour for a search box and wrong behaviour for a reference.

> [!NOTE]
> One v1 limit: `@` and `?` are mutually exclusive in the address grammar, so a query cannot yet be scoped to a concept.
