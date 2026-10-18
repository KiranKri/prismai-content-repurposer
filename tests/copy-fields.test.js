import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyAllForPlatform, copyAllText, inCopyAll, fieldValueText } from "../src/copy-fields.js";

const report = JSON.parse(readFileSync(new URL("./fixtures/spoke-and-wheel.platforms.json", import.meta.url), "utf8"));
const p = report.platforms;

// Field labels as the report shows them (CSS uppercases them on screen).
const LABELS = [
  "EMAIL SUBJECT LINE", "SUBJECT LINE", "INBOX PREVIEW TEXT", "EMAIL BODY", "CALL TO ACTION", "POST TEXT",
  "CAPTION", "HASHTAGS", "CAROUSEL SLIDES", "VIDEO TITLE", "VIDEO DESCRIPTION", "SPOKEN SCRIPT",
  "ON-SCREEN TEXT OVERLAYS", "B-ROLL SHOT IDEAS", "REEL ON-SCREEN HOOK", "HOW TO USE THIS", "PRODUCTION NOTES",
];

function assertNoLabels(text) {
  for (const label of LABELS) assert.ok(!text.includes(label), `clipboard contains the label ${label}`);
}

test("LinkedIn: post text and hashtags only, no carousel slides", () => {
  const text = copyAllForPlatform(p.linkedin);
  assert.equal(text, [p.linkedin.content, "#BikeRepair #CyclingCommunity"].join("\n\n"));
  assert.ok(!text.includes("Slide"));
  assert.ok(!text.includes("UsageNote"));
  assertNoLabels(text);
});

test("Instagram: caption and hashtags only, no reel hook or production notes", () => {
  const text = copyAllForPlatform(p.instagram);
  assert.equal(text, [p.instagram.caption, "#BikeMaintenance #SaturdayRide"].join("\n\n"));
  assert.ok(!text.includes("ReelHook"));
  assert.ok(!text.includes("ProdNotes"));
  assertNoLabels(text);
});

test("YouTube Shorts: title, description and hashtags only", () => {
  const text = copyAllForPlatform(p.youtube_shorts);
  assert.equal(text, [p.youtube_shorts.title, p.youtube_shorts.description, "#BikeTips #Shorts"].join("\n\n"));
  for (const marker of ["SpokenScript", "Overlay", "Broll", "UsageNote"]) assert.ok(!text.includes(marker), marker);
  assertNoLabels(text);
});

test("Email: subject, preview text, body and CTA", () => {
  const e = p.email_newsletter;
  const text = copyAllForPlatform(e);
  assert.equal(text, [e.subject_line, e.preview_text, e.body, e.cta].join("\n\n"));
  assert.ok(!text.includes("UsageNote"));
  assertNoLabels(text);
});

test("fields are joined by exactly one blank line and trimmed", () => {
  const text = copyAllText([
    { key: "caption", text: "  First  " },
    { key: "hashtags", text: "#a #b\n" },
  ]);
  assert.equal(text, "First\n\n#a #b");
});

test("an explicit data-all=\"0\" flag wins over the key", () => {
  const text = copyAllText([
    { key: "caption", text: "Keep" },
    { key: "caption", text: "Drop", all: false },
  ]);
  assert.equal(text, "Keep");
});

test("fields without a Copy button and empty fields are skipped", () => {
  const text = copyAllText([
    { key: "caption", text: "Keep" },
    { key: "usage_tip", text: "Tip" },
    { key: "subreddit_details", text: "Notes" },
    { key: "hashtags", text: "   " },
  ]);
  assert.equal(text, "Keep");
});

test("production-note keys are flagged out of Copy all", () => {
  for (const key of ["carousel_slides", "script", "reel_hook", "production_notes", "on_screen_text", "on_screen_overlays", "b_roll_ideas", "b_roll_shot_ideas"]) {
    assert.equal(inCopyAll(key), false, key);
  }
  for (const key of ["content", "post", "caption", "hashtags", "title", "description", "subject_line", "preview_text", "body", "cta"]) {
    assert.equal(inCopyAll(key), true, key);
  }
});

test("hashtags are normalised to #tag and joined by spaces", () => {
  assert.equal(fieldValueText("hashtags", ["#One", "Two"]), "#One #Two");
  assert.equal(fieldValueText("hashtags", "one, #two three"), "#one #two #three");
});
