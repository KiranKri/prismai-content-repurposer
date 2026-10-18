// Runs the PDF layout checker on every sample PDF. Findings must match samples/samples.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkPdf } from "./check-pdf.js";

const manifest = JSON.parse(readFileSync(new URL("../../samples/samples.json", import.meta.url), "utf8"));

const findings = (rep) => [
  ...rep.docResults.map((r) => `${r.level} document ${r.check}`),
  ...rep.pageResults.flatMap((p) => p.results.map((r) => `${r.level} page ${p.page} ${r.check}`)),
].sort();

for (const s of manifest.samples) {
  test(`${s.brand} (${s.template}): PDF findings match samples.json`, async () => {
    const rep = await checkPdf(fileURLToPath(new URL(`../../samples/${s.slug}/report.pdf`, import.meta.url)));
    assert.deepEqual(findings(rep), [...s.knownIssues.pdf].sort());
    for (const p of rep.pageResults) {
      assert.equal(p.width, 612, `page ${p.page} width`);
      assert.equal(p.height, 792, `page ${p.page} height`);
    }
  });
}
