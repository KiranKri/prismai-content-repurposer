# Decisions

Short records of the decisions that shaped PrismAI and this repo. Each has the context, the decision and what it cost.

## 1. Build the report in code, not in a template

**Context.** The report needs cards in a posting order chosen by the model, optional fields, lists of different shapes, and two outputs (web and PDF).

**Decision.** One JavaScript function builds both the web page and the PDF page from the formatter's JSON.

**Consequence.**
- The web page and the PDF cannot drift apart, and the builder can normalise messy model output before rendering.
- The cost is that the HTML lives inside a string-building function, which is harder to read than a template.

## 2. Ask the models for JSON, render with code

**Context.** Labels, field order and Copy behaviour should not depend on how a model happens to format its answer.

**Decision.** Every generation step returns structured JSON, and only the builder decides how a field looks.

**Consequence.**
- Labels, order and Copy behaviour are under code control and can be tested.
- Field names still vary between runs, so the builder keeps a list of known variants.

## 3. Serve the hosted PDF, print the edited page

**Context.** In round 1, "Save as PDF" called `window.print()`. In round 2, the primary "Download PDF" button ignored the buyer's edits.

**Decision.** There are two buttons:
- "Download original PDF" fetches the PDF that MindStudio rendered.
- "Print edited version" prints the edited page with the same paged CSS as the PDF.

**Consequence.** It is always clear which output has the edits. The printed version depends on the buyer's browser, so it can differ slightly from the hosted PDF.

## 4. Let cards break across pages

**Context.** Round 1 kept every card whole with `break-inside: avoid`, and one PDF page was about 64% empty.

**Decision.** Cards may break across pages. The rules keep together only:
- a heading with its first lines;
- hashtag strips, timeline rows and list items;
- the last field of a card;
- (from v7) the Instagram preview frame.

**Consequence.** Less blank space, but each rule moves content around and has caused a new orphan or gap in later rounds (see [design-iterations.md](design-iterations.md)). This is why the PDF checker exists.

## 5. Mark the fields Copy all should skip

**Context.** Copy all is for pasting into the platform. Round 3 found it pasting LinkedIn carousel slides and YouTube scripts.

**Decision.** The builder marks production-note fields (slides, scripts, overlays, B-roll, reel hook, notes) with `data-all="0"`. The Copy all handler skips those and joins the rest, values only, with a blank line between them.

**Consequence.** One list in one place decides what is pasted. A new field type is included by default until it is added to that list.

## 6. Normalise timeline labels

**Context.** Models write timings in many forms: "0-3 seconds, during hook", "Appears at 10-13s, as legacy is mentioned", "52-60s", or a phase with no time at all. Printed raw, the time column wrapped to five lines on a phone.

**Decision.** Split each timing into a short time label and a phase line. The time label always uses an en dash for the range (`0–3s`), and the phase is cleaned of lead-ins and leftover punctuation and capitalised.

**Consequence.** Consistent labels. Round 4 showed the cleaning can leave stray text, which is now covered by a regression test.

## 7. Keep prompts and generation logic private

**Context.** PrismAI is built to be sold, and the prompts are what a competitor would copy.

**Decision.** Two repositories:
- a private one with the prompts, the workflow and the builder;
- this public one, with rendered samples, two extracted pure functions, tests and docs.

**Consequence.** Reviewers see the output, the testing and the reasoning, but not the prompts. The rendered samples contain the report's front-end code, as every delivered report does.

## 8. Copy the samples into the repo

**Context.** The delivered links are hosted by MindStudio, and I do not control how long they last.

**Decision.** Each sample's HTML, PDF and images are stored here, with image and PDF links rewritten to local files, and served from GitHub Pages.

**Consequence.** The gallery keeps working on its own. The samples are snapshots: they do not change when the product does.

## 9. Test the shipped files, keep the old ones

**Context.** Unit tests on extracted functions can pass while the real page does something else.

**Decision.**
- The tests load every sample report, run its own inline script and click its own Copy all buttons.
- The PDF checker reads the PDFs that MindStudio actually rendered.
- Older builds stay in the repo with their known issues listed in `samples/samples.json`.

**Consequence.** The tests prove two things: that the current build passes, and that the checks would have caught each earlier bug. Adding a sample means recording what the checks find in it.
