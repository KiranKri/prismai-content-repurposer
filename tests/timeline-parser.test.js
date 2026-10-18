import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTiming } from "../src/timeline-parser.js";

// Required cases from the brief (Section 5a). The live code always writes the time range with an
// en dash ("0–3s"), whatever dash the model used, so the expected times below use an en dash.
const cases = [
  ["0-3 seconds, during hook", "0–3s", "During hook"],
  ["0–3 seconds, during hook", "0–3s", "During hook"],
  ["Appears at 0-3s, during hook", "0–3s", "During hook"],
  ["Appears at 10-13s, as legacy is mentioned", "10–13s", "As legacy is mentioned"],
  ["Early — during hook (0-8 sec)", "0–8s", "Early — during hook"],
  ["52-60s", "52–60s", ""],
  ["during CTA", "", "During CTA"],
];

for (const [input, time, phase] of cases) {
  test(`parseTiming(${JSON.stringify(input)})`, () => {
    assert.deepEqual(parseTiming(input), { time, phase });
  });
}

// More cases, in the shapes seen in the samples.
const more = [
  ["Appears at 0–3 seconds, as the hook lands", "0–3s", "As the hook lands"],
  ["Appears at 14–17 seconds, as the price is mentioned", "14–17s", "As the price is mentioned"],
  ["Shown at 50–58 seconds, during the sign-off", "50–58s", "During the sign-off"],
  ["Appears at 0–3s — during hook", "0–3s", "During hook"],
  ["0:00-0:03 hook", "0:00–0:03", "Hook"],
  ["3s", "3s", ""],
  ["", "", ""],
  ["Hook", "Hook", ""],
  ["Appears during hook", "", "During hook"],
];

for (const [input, time, phase] of more) {
  test(`parseTiming(${JSON.stringify(input)})`, () => {
    assert.deepEqual(parseTiming(input), { time, phase });
  });
}


// Regression: a shipped build rendered the phase as "Appears at , during hook".
const timings = [
  ...cases.map((c) => c[0]),
  ...more.map((c) => c[0]),
  "Appears at 0-3s, during hook",
  "appears at 0-3 sec , during hook",
  "Shown at 4–7s; as the price is mentioned",
  "Starting at 20-25 seconds: during key point 2",
  "Appears from 30–35s, as key point 3 is spoken",
  "Around 45-50 sec - before the CTA",
  "(0-3s) during hook",
  "[10-13s] as legacy is mentioned",
];

for (const input of timings) {
  test(`phase for ${JSON.stringify(input)} has no stray punctuation`, () => {
    const { time, phase } = parseTiming(input);
    assert.doesNotMatch(phase, /^[\s,;:.–—()\[\]-]/, `phase starts with punctuation: ${JSON.stringify(phase)}`);
    assert.ok(!phase.includes(" ,"), `phase contains " ,": ${JSON.stringify(phase)}`);
    assert.doesNotMatch(phase, /^appears? at\b/i, `phase kept the lead-in: ${JSON.stringify(phase)}`);
    assert.doesNotMatch(time, /\s/, `time label would wrap: ${JSON.stringify(time)}`);
  });
}
