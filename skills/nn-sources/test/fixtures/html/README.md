# HTML extraction regression fixtures

Verbatim copies of six sources taken from `Y:\My Drive\_NN\PD_NN\sources\import\`
(the 2026-10-20 source-cognitivization audit that produced issue #266). Each file is
the raw downloaded page that produced a defect, kept byte-identical so the converter
is measured against the real input rather than a reduced stand-in.

| Fixture | Defect it pins |
|---|---|
| `FT_55866_20261017T165551Z.html` | CRLF document: the body was 82.5% blank lines and carried 496 undecoded entities (`&iacute;`, `&#243;`) |
| `PMC9547138_20261017T173000Z.html` | Navigation pollution: the body opened with `Skip to main content`, `Log in`, `Dashboard`, `Account settings` |
| `NBK1478_20261017T174010Z.html` | reCAPTCHA interstitial (`Checking your browser…`) ingested as an ordinary source |
| `s10072-023-06789-7_20261017T181030Z.html` | Springer `Client Challenge` wall; its `<noscript>` prose was the entire body |
| `920_20261017T190632Z.html` | JavaScript wall whose markup carries no extractable text, so the body came out empty |
| `37032388-15-year-subthalamic-…-case-report_20261017T181041Z.html` | Zero-byte download: registered a source whose `sha256` was the hash of the empty string |

`FT_55866_20261017T165551Z.html` is 68 KB and `PMC9547138_20261017T173000Z.html` is
300 KB. They are committed whole on purpose: a trimmed copy would stop exercising the
real page weight and the real chrome.

Assertions live in `test/unit/test-web-import.js`; every fixture has at least one.
