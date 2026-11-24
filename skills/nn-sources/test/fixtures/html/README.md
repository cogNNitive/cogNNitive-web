# HTML extraction regression fixtures

Synthetic pages that reproduce the defects found in the 2026-10-20 source-cognitivization
audit (issue #266). Every file was written for these tests: the prose, names, hosts and
tokens are invented, and none of them is a copy of a downloaded page. This repository is
public, so a fixture must never be a page captured from a real domaiNN.

`pmc-chrome-synthetic.html` keeps the PMC page chrome (an NCBI page, a US government work)
around an invented article, because that chrome is what the navigation defect is about.

| Fixture | Defect it pins |
|---|---|
| `crlf-entities-synthetic.html` | CRLF document: the raw markup is ~80% blank lines and carries numeric and named entities (`&iacute;`, `&#243;`) |
| `pmc-chrome-synthetic.html` | Navigation pollution: the body opened with `Skip to main content`, `Log in`, `Dashboard`, `Account settings` |
| `captcha-wall-synthetic.html` | Captcha interstitial (`Checking your browser…`) ingested as an ordinary source |
| `client-challenge-synthetic.html` | `Client Challenge` wall; its `<noscript>` and error prose was the entire body |
| `script-only-wall-synthetic.html` | JavaScript wall whose markup carries no extractable text, so the body came out empty |
| `zero-byte-download.html` | Zero-byte download: registered a source whose `sha256` was the hash of the empty string |

`crlf-entities-synthetic.html` (52 KB) and `pmc-chrome-synthetic.html` (83 KB) are large on
purpose: a trimmed page would stop exercising real page weight.

Assertions live in `test/unit/test-web-import.js`; every fixture has at least one.
