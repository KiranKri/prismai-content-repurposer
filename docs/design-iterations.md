# Design iterations

Between 17 and 18 October 2026 the report went through four review rounds. Each round followed the same loop: find the problem, measure it, fix it, verify the fix, then look for what the fix broke.

## How the numbers were measured

**Rounds 1 to 4 (17 and 18 October 2026).** Measured with:
- Claude in Chrome: live page inspection, clipboard interception, and a 390px viewport for phone checks;
- pdf.js: font sizes and positions from each PDF's text layer;
- ChatGPT and Gemini as second-opinion reviewers in round 4.

**Latest build (18 October 2026, measured by me while writing this repo):**
- **Web page:** the published Lotus Loft Yoga report, in Playwright with Chromium 155 at 390px and 1280px wide. Contrast is the WCAG ratio of each element's computed text colour against its first opaque background. Copy all was measured by replacing `navigator.clipboard.writeText` and clicking each card's button.
- **PDF:** the PDF layout checker in this repo (pdf.js 6.3.289). Its output is in [testing.md](testing.md).

The sample files for each round are in the [gallery](https://kirankri.github.io/prismai-content-repurposer/) (files in [samples/](../samples)). The tests re-check them on every push.

## Round 1: first review (three samples, including Crumb & Co)

The first build worked, but it read like a web page squeezed onto paper.

| Problem | Measurement |
|---|---|
| PDF text too small to read | Body text 6.7pt, labels 4.8 to 5.1pt. The 820px web layout had been shrunk to fit the Letter page. |
| Copy buttons far down the page | First Copy button at 1,579px of a 2,870px page on desktop (55% down), and at 2,658px of 4,888px on a phone |
| Copy put labels on the clipboard | Pasting a field gave `EMAIL SUBJECT LINE` followed by the value |
| Large blank PDF page | Sample B page 2 was about 64% empty, because every card was kept whole with `break-inside: avoid` |
| Order and clipping | The publishing plan order did not match the card order, and the brand voice value was clipped on the PDF cover |
| "Save as PDF" | It called `window.print()` instead of serving the hosted PDF |

The PDF checker in this repo measures the same thing on the Crumb & Co sample (round 1, sample B):
- body text 6.7pt;
- labels at 4.8pt and 5.1pt;
- page 2 is 63.9% blank.

The sample page test shows the label bug too: Copy all on the email card starts with "EMAIL SUBJECT LINE".

## Round 2: redesign (Brew & Co)

**Fix.** A redesigned layout, with PDF font sizes set so they survive the renderer's scaling, and Inter embedded.

**Verified:**
- PDF body text 10.5pt, labels 7.9pt.
- On a phone, the first Copy button moved from 2,658px to 791px, and the mobile toolbar shrank from 99px to 47px.
- Per-field Copy and a "Copied" state (1.5s) work.
- Copy all copies values without labels.

**Found (new and remaining problems):**
- The cover image was cropped by 44%: a square image in a 16:9 box.
- An orphaned hashtag strip at the top of PDF page 4.
- The timeline time column wrapped to 3 lines on desktop and 5 on phones.
- The primary "Download PDF" silently ignored the buyer's edits.

The checker flags the page 4 fragment on the Brew & Co sample: the hashtag label and strip sit alone above the next card. The sample test shows two more things:
- the time column holds the whole raw string ("0–3 seconds, during hook");
- Copy all still pastes the reel hook, spoken script, overlays and B-roll ideas.

## Round 3: Spoke & Wheel

**Fix.**
- Timeline split into a short time label (`0-3s`) plus a phase line.
- An edited-state button swap, for the "Download PDF ignores edits" finding.
- A real PNG image download (about 1 MB).
- Title Case titles and outline badges.

**Found:**
- Framed post text was only 233px wide on a 390px phone.
- LinkedIn Copy all included the carousel slides: slide text began at character 925 of 1,981.
- PDF page 7 was 83% blank, and the YouTube header was stranded at the bottom of PDF page 4.
- The Instagram image was a 2.2in thumbnail in the PDF.
- The toolbar grew from 50px to 76px after an edit.
- From the round 4 cross-check:
  - an edited slide title lost its bold style after reload;
  - Reset showed on an unedited page;
  - label contrast was below 4.5:1 (footer 2.80, metadata keys 3.37, timeline phase 3.67, slide badges 4.11, edit note 4.34).

The repo's checks confirm this on the Spoke & Wheel sample:
- **LinkedIn Copy all:** 1,981 characters, with the carousel slides starting at character 925.
- **YouTube Copy all:** includes the spoken script.
- **PDF page 7:** 82.7% blank.
- **The YouTube Shorts heading:** sits 12.6% above the bottom of the printable area on page 4, with only the video title below it.

## Round 4: Masala Corner

**Fixes for the round 3 findings, verified:**
- Phone post text 325px (from 233px).
- Label contrast 5.2 to 6.0:1.
- Copy all correct for all four platforms.
- Edits keep their formatting after reload.
- Toolbar stays at 51px after an edit.
- Reset hidden until an edit.

**Found, and since fixed in template v7:**
- The timeline phase rendered as `Appears at , during hook`. The code removed the time from "Appears at 0-3s, during hook" but left the words around it.
- The Instagram caption tail and hashtags were orphaned at the top of PDF page 5.

The Masala Corner sample is the round 4 build, so it still has both bugs. The sample test finds `Appears at ,` in every overlay phase. The checker flags page 5: one caption line and the hashtag strip above the YouTube Shorts heading.

## Latest build: Lotus Loft Yoga (template v7)

The v7 timeline fix worked: every phase is clean, for example "During the hook" and "As key point 1 is spoken".

I re-measured the round 4 results on this build:

| Check | Round 4 | Latest build |
|---|---|---|
| Framed post text width, 390px phone | 325px | 328px |
| Lowest label contrast | 5.2:1 | 5.21:1 (slide badges). Footer 5.49, metadata keys 5.49 to 5.98, field labels 5.78 to 5.98, timeline phase 5.98, edit note 5.98 |
| Copy all, four platforms | Correct | Correct: post content and hashtags only, no labels. LinkedIn 1,391 characters with no slides; YouTube Shorts 373 with no script, overlays or B-roll |
| Edit persistence | Keeps formatting | Edited slide title still a bold `slide-t` paragraph after reload |
| Toolbar height after an edit | 51px | 51px desktop, 47px phone, the same before and after the edit |
| Reset before any edit | Hidden | Hidden; it shows after an edit |
| First Copy button | 791px on a phone (round 2) | 493px of 8,516px on a phone, 403px of 6,668px on desktop |
| PDF body text | 10.5pt | 10.5pt, smallest text 7.1pt |

**Found, a new regression:** PDF page 4 is 72.5% blank. The email card ends about a quarter of the way down the page, and the Instagram card starts on page 5. The most likely cause is the v7 keep-together rule: the Instagram preview frame is kept whole and is taller than the space left. The checker fails this page (the limit is 70%).

**Found, the Instagram orphan is not fully gone:** page 6 opens with the last two lines of the Instagram caption and its hashtags, then the YouTube Shorts heading. That is one line more than the checker's fragment threshold (fewer than 3 lines), so it is not flagged.

TODO(KK): decide how to fix the page 4 gap, for example by letting the frame break when it would leave more than half a page empty, and confirm on a new MindStudio build.

## Summary

| Problem | Before | After |
|---|---|---|
| PDF body text | 6.7pt | 10.5pt |
| First Copy button on a phone | 2,658px | 791px |
| Post text width on a phone | 233px | 325px |
| Worst blank PDF page | 83% | 46% in round 4, but 72.5% in the latest build |
| Lowest label contrast | 2.80:1 | 5.2:1 |
| Copy all pasting wrong content | Labels, slides, script | Values for that platform only |

## Lessons

Every fix round introduced a regression:
- **The orphan moved between cards.** Hashtags were orphaned on Brew & Co page 4. They were fixed for that card, then reappeared under Instagram on Masala Corner page 5. Keeping the Instagram frame whole in v7 was meant to fix that. On Lotus Loft Yoga a shorter fragment remains on page 6, and page 4 now has a 72.5% gap.
- **The parser left stray text.** Splitting the timing string fixed the wrapped time column, then left `Appears at ,` in the phase.
- **Copy all was fixed for one platform but not another.** Labels were removed in round 2. Carousel slides and the spoken script were still pasted for LinkedIn and YouTube in round 3, until the list of excluded fields was completed in round 4.

Each of these was found by looking, after the fact. That is why the tests in this repo exist:
- unit tests for the parser and the Copy all selection;
- a test that runs every sample's own Copy all code;
- a PDF checker for blank space, fragments and stranded headings.

They run on every push. The older samples stay in the repo as proof that the checks catch the bugs those builds shipped with.
