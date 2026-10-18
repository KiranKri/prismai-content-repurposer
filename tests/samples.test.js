// Runs each sample report's own script, clicks Copy all on every card, and checks the clipboard text
// and the timeline labels. Findings must match samples/samples.json: the current build must be clean,
// and older builds must still show the bugs they shipped with, which proves the checks catch them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSample, copyAllFindings, timelineFindings } from "./lib/sample-page.js";

const manifest = JSON.parse(readFileSync(new URL("../samples/samples.json", import.meta.url), "utf8"));

for (const s of manifest.samples) {
  const file = new URL(`../samples/${s.slug}/report.html`, import.meta.url);

  test(`${s.brand} (${s.template}): Copy all and timeline findings match samples.json`, async () => {
    const page = await loadSample(file);
    assert.ok(page.cards.length > 0, "no cards found");
    const copy = page.cards.flatMap(copyAllFindings).sort();
    assert.deepEqual(copy, [...s.knownIssues.copyAll].sort(), "Copy all findings changed");
    assert.deepEqual(timelineFindings(page.timeline).sort(), [...s.knownIssues.timeline].sort(), "timeline findings changed");
  });

  if (s.current) {
    test(`${s.brand} (current build): Copy all pastes only post content, with no labels`, async () => {
      const page = await loadSample(file);
      for (const card of page.cards) {
        assert.ok(card.copyAll && card.copyAll.length > 0, `${card.id}: Copy all copied nothing`);
        assert.deepEqual(copyAllFindings(card), [], card.id);
        for (const f of card.fields) {
          assert.ok(!card.copyAll.includes(f.label.toUpperCase() + "\n"), `${card.id}: label ${f.label} on clipboard`);
        }
        assert.ok(!/\n{3,}/.test(card.copyAll), `${card.id}: more than one blank line between fields`);
      }
      assert.deepEqual(timelineFindings(page.timeline), []);
    });
  }
}
