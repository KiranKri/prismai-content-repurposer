# Testing

What is tested, how, and why. Everything runs with Node 22.13 or later (pdf.js 6 needs it). CI uses Node 24.

```
npm ci
npm test            # all tests: unit, sample pages, PDF checks
npm run check:pdf   # the PDF checker report for every sample PDF
```

There are two dev dependencies:
- `pdfjs-dist`, to read the PDF text layer;
- `happy-dom`, to run the sample pages' own scripts outside a browser.

Both are pinned to exact versions. CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs `npm test` on every push and pull request.

## Why these tests

Every review round fixed something and broke something else (see [design-iterations.md](design-iterations.md)). The same three things kept going wrong:
- what Copy all pastes;
- how the timeline labels are cleaned;
- where the PDF breaks pages.

The tests cover exactly those. The prompts are not tested here because they are private.

## 1. Timeline parser (`tests/timeline-parser.test.js`)

[`src/timeline-parser.js`](../src/timeline-parser.js) is the parser from the report builder, extracted unchanged as a pure function. A parity test in the private repo fails if this copy and the builder's code differ.

`parseTiming(raw)` returns `{ time, phase }`. `time` is a short label that never wraps, and `phase` is a capitalised description or an empty string.

| Input | time | phase |
|---|---|---|
| `0-3 seconds, during hook` | `0–3s` | `During hook` |
| `0–3 seconds, during hook` | `0–3s` | `During hook` |
| `Appears at 0-3s, during hook` | `0–3s` | `During hook` |
| `Appears at 10-13s, as legacy is mentioned` | `10–13s` | `As legacy is mentioned` |
| `52-60s` | `52–60s` | (empty) |
| `during CTA` | (empty) | `During CTA` |

The parser always writes the range with an en dash, whatever dash the model used, so `0-3` becomes `0–3s`. The tests also cover timings that use an em dash as the separator, or put the time in brackets after the phase.

The `during CTA` case was a bug found while writing these tests: a timing with no time in it skipped the phase clean-up, so it stayed lower case. It is fixed in the builder source and goes live with the next MindStudio update. Open: confirm it on that build.

**Regression test.** One build shipped the phase as `Appears at , during hook`. For 24 timing strings, the test fails if a phase:
- starts with punctuation;
- contains ` ,`;
- still starts with "Appears at".

It also fails if a time label contains a space.

## 2. Copy all field selection (`tests/copy-fields.test.js`)

[`src/copy-fields.js`](../src/copy-fields.js) reproduces the two halves of Copy all as pure functions:
- the list of fields the builder marks `data-all="0"`, copied unchanged;
- the browser handler that joins the remaining values with one blank line between them.

A synthetic Spoke & Wheel fixture checks each platform:

| Platform | Copy all must contain | Must not contain |
|---|---|---|
| LinkedIn | post text, hashtags | carousel slides, usage tip |
| Instagram | caption, hashtags | reel on-screen hook, production notes |
| YouTube Shorts | title, description, hashtags | spoken script, on-screen overlays, B-roll ideas |
| Email | subject, preview text, body, CTA | usage tip |

No output may contain a field label such as `EMAIL SUBJECT LINE`. Further tests cover trimming, the blank-line join, fields without a Copy button, empty fields and hashtag normalisation.

## 3. The sample pages (`tests/samples.test.js`)

The unit tests prove the extracted logic. This test proves the real pages.

For every sample in `samples/`, it does the following in happy-dom:
1. loads `report.html`;
2. runs the page's own inline script;
3. replaces `navigator.clipboard.writeText`;
4. clicks every Copy and Copy all button.

It then checks each card's Copy all text against the rules in the table above, and the timeline labels against the parser rules.

The findings must match `knownIssues` in [`samples/samples.json`](../samples/samples.json):
- **The current build** (Lotus Loft Yoga) must have no Copy all or timeline findings.
- **Older builds** must still show the bugs they shipped with:

| Sample | Findings |
|---|---|
| Masala Corner (round 4) | `Appears at ,` in the timeline phases |
| Spoke & Wheel (round 3) | Copy all includes LinkedIn carousel slides and the YouTube script |
| Brew & Co (round 2) | Copy all includes the reel hook, script, overlays and B-roll; raw strings in the time column |
| Crumb & Co (round 1) | field labels on the clipboard |

This shows that the checks catch real regressions, not just the cases I thought of.

**Cross-check in a real browser.** On the published Lotus Loft Yoga report in Chromium 155, Copy all produced 1,391, 1,106, 1,008 and 373 characters for the four cards. happy-dom produced the same four lengths.

## 4. PDF layout checker (`tests/pdf-checks/`)

[`check-pdf.js`](../tests/pdf-checks/check-pdf.js) reads a PDF with pdf.js and reports per page. It exits with code 1 if any check fails. `pdf-checks.test.js` runs it on every sample PDF and compares the findings with `samples.json`.

| Check | Rule |
|---|---|
| Page size | 612 x 792 pt (US Letter), within 1pt. Fail otherwise. |
| Body font size | Fail if the most common text size in the document (weighted by characters) is below 10pt. |
| Smallest text | Fail if any text on a page is below 7pt. |
| Blank space | Space below the last text or image, as a percentage of the page. Warn above 40%, fail above 70%. The final page may reach 85% if it is the strategy appendix. |
| Fragment at page top | Warn if a page starts with fewer than 3 lines of the previous card before the next card heading. |
| Stranded heading | Warn if a platform heading sits in the bottom 15% of the printable area. |

How the checker works:
- **Card headings:** a line that is a platform name (LinkedIn, Instagram, YouTube Shorts, Email Newsletter, and the other six) set larger than the body text.
- **Fragment count:** lines larger than body text (section headings) and "Post N" badges are not counted. A hashtag strip that wraps over several lines counts as one line.
- **Printable area:** the page inside the report's `@page` margins (0.6in top, 0.65in bottom). The page bottom itself is always blank margin.

These two refinements make the checker flag both the round 4 Masala Corner orphan (one caption line plus the hashtag strip) and the round 3 Spoke & Wheel heading, without false alarms on the other pages.

Limits:
- Blank space counts text and images but not vector shapes, such as card borders.
- Text drawn as outlines would not be seen.
- The time labels in the timelines use tabular figures, and their digits do not appear in the PDF text layer. The checker does not rely on them.

**Where the PDFs come from.** The sample PDFs were rendered by MindStudio's own PDF renderer, headless Chrome 128, so the checker sees exactly what a buyer receives. A PDF rendered locally with a different Chrome version, or even Chrome 128 with different fonts installed, is only an approximation: line breaks and therefore page breaks can move. Layout changes must be confirmed on a real MindStudio build.

### Current output

`npm run check:pdf` on 18 October 2026:

```
samples/brew-and-co/report.pdf: 5 pages, body text 10.5pt, 0 fail, 1 warn
  page 1: ok   612x792pt, min text 7.9pt, blank 8.1%
  page 2: ok   612x792pt, min text 7.9pt, blank 11%
  page 3: ok   612x792pt, min text 7.9pt, blank 10.7%
  page 4: WARN 612x792pt, min text 7.9pt, blank 9.4%
    WARN fragment-top: page starts with 2 line(s) of the previous card before "Email Newsletter": "HASHTAGS"
  page 5: ok   612x792pt, min text 7.9pt, blank 34.7% (appendix)

samples/crumb-and-co/report.pdf: 3 pages, body text 6.7pt, 4 fail, 1 warn
  FAIL body-font: most common text size is 6.7pt (below 10pt)
  page 1: FAIL 612x792pt, min text 4.8pt, blank 25.1%
    FAIL min-font: text at 4.8pt (below 7pt): "BRAND Crumb & Co AUDIENCE local food lov"
  page 2: FAIL 612x792pt, min text 5.1pt, blank 63.9%
    FAIL min-font: text at 5.1pt (below 7pt): "EMAIL SUBJECT LINE"
    WARN blank-space: 63.9% of the page is blank below the last content
  page 3: FAIL 612x792pt, min text 5.1pt, blank 17%
    FAIL min-font: text at 5.1pt (below 7pt): "VIDEO TITLE"

samples/lotus-loft-yoga/report.pdf: 8 pages, body text 10.5pt, 1 fail, 0 warn
  page 1: ok   612x792pt, min text 7.9pt, blank 8.1%
  page 2: ok   612x792pt, min text 7.6pt, blank 7.3%
  page 3: ok   612x792pt, min text 7.1pt, blank 8.1%
  page 4: FAIL 612x792pt, min text 10.5pt, blank 72.5%
    FAIL blank-space: 72.5% of the page is blank below the last content
  page 5: ok   612x792pt, min text 7.6pt, blank 17.1%
  page 6: ok   612x792pt, min text 7.6pt, blank 17.7%
  page 7: ok   612x792pt, min text 7.9pt, blank 6.7%
  page 8: ok   612x792pt, min text 7.9pt, blank 32.7% (appendix)

samples/masala-corner/report.pdf: 7 pages, body text 10.5pt, 0 fail, 2 warn
  page 1: ok   612x792pt, min text 7.9pt, blank 8.1%
  page 2: ok   612x792pt, min text 7.6pt, blank 12.6%
  page 3: ok   612x792pt, min text 7.1pt, blank 24.8%
  page 4: ok   612x792pt, min text 7.6pt, blank 14.9%
  page 5: WARN 612x792pt, min text 7.6pt, blank 8.6%
    WARN fragment-top: page starts with 2 line(s) of the previous card before "YouTube Shorts": "Secure your spot in our subscription pro"
  page 6: WARN 612x792pt, min text 7.9pt, blank 46%
    WARN blank-space: 46% of the page is blank below the last content
  page 7: ok   612x792pt, min text 7.9pt, blank 24.5% (appendix)

samples/spoke-and-wheel/report.pdf: 7 pages, body text 10.5pt, 1 fail, 1 warn
  page 1: ok   612x792pt, min text 7.9pt, blank 8.1%
  page 2: ok   612x792pt, min text 7.6pt, blank 10.5%
  page 3: ok   612x792pt, min text 7.6pt, blank 18.2%
  page 4: WARN 612x792pt, min text 7.6pt, blank 11.3%
    WARN stranded-heading: "YouTube Shorts" heading at 12.6% from the bottom of the printable area
  page 5: ok   612x792pt, min text 7.9pt, blank 9.3%
  page 6: ok   612x792pt, min text 7.9pt, blank 12.5%
  page 7: FAIL 612x792pt, min text 7.9pt, blank 82.7%
    FAIL blank-space: 82.7% of the page is blank below the last content
```

Exit code 1, because of the failures in the round 1 sample, the round 3 sample and the latest build. All of them are listed in `samples.json`, so `npm test` passes and any change in the findings fails it.

The latest build's page 4 failure (72.5% blank) is a real, open regression. Open: fix it in the builder and replace the sample with a new build.

## 5. Not tested here

- **Prompt output quality.** It needs the prompts and the models, which are private.
- **The report builder itself.** The private repo runs it on a fixture in its own parity tests.
- **Visual rendering in Chrome 128.** The checks read the PDF text layer and the page script, not pixels.
