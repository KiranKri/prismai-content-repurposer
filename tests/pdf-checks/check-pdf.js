// PDF layout checker for PrismAI reports.
// Usage: node tests/pdf-checks/check-pdf.js [--json] <file.pdf | folder> ...  (a folder is searched for .pdf files)
// Exit code 1 if any check fails on any file. Warnings are reported but do not fail.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

export const LIMITS = {
  pageWidth: 612,
  pageHeight: 792,
  sizeTolerance: 1,
  minBodySize: 10, // most common text size, pt
  minAnySize: 7, // smallest text allowed, pt
  blankWarn: 40, // % of the page below the last content
  blankFail: 70,
  blankFailAppendix: 85, // final page, only when it is the strategy appendix
  fragmentLines: 3, // fewer lines than this above the first card heading = fragment
  strandedZone: 0.15, // heading in the bottom 15% of the printable area
  marginTop: 43.2, // @page margin in the report CSS: 0.6in
  marginBottom: 46.8, // 0.65in
};

const PLATFORMS = ["LinkedIn", "Instagram", "YouTube Shorts", "Email Newsletter", "Email newsletter", "TikTok", "Facebook",
  "Threads", "Reddit", "X (Twitter)", "Twitter / X", "Blog / Medium Teaser", "Blog / Medium"];
const APPENDIX = /\b(at a glance|key ideas|problem it solves|strategy notes)\b/i;

const r1 = (n) => Math.round(n * 10) / 10;

// Multiply two PDF transform matrices [a b c d e f].
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

// Lowest point (PDF y, from the page bottom) of every image painted on the page.
async function imageBottoms(page) {
  const ops = await page.getOperatorList();
  const bottoms = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const paints = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject,
    OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat, OPS.paintSolidColorImageMask]);
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (paints.has(fn)) {
      const ys = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => ctm[1] * x + ctm[3] * y + ctm[5]);
      bottoms.push({ bottom: Math.min(...ys), top: Math.max(...ys) });
    }
  }
  return bottoms;
}

// Text items -> lines (items on the same baseline, within 1.5pt), top of page first.
function toLines(items) {
  const lines = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const size = Math.hypot(it.transform[2], it.transform[3]);
    const y = it.transform[5];
    let line = lines.find((l) => Math.abs(l.y - y) <= 1.5);
    if (!line) { line = { y, parts: [], sizes: [] }; lines.push(line); }
    line.parts.push({ x: it.transform[4], str: it.str, size });
    line.sizes.push(size);
    line.y = Math.min(line.y, y);
  }
  for (const l of lines) {
    l.parts.sort((a, b) => a.x - b.x);
    l.text = l.parts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
    l.maxSize = Math.max(...l.sizes);
  }
  return lines.sort((a, b) => b.y - a.y);
}

// A card heading: the line is (or starts with) a platform name, larger than body text.
function headingName(line, bodySize) {
  if (line.maxSize < bodySize * 1.2) return null;
  const big = line.parts.filter((p) => p.size >= bodySize * 1.2).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
  return PLATFORMS.find((n) => big === n || big.startsWith(n + " ")) || null;
}

export async function checkPdf(file) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0, useSystemFonts: false }).promise;
  const pages = [];
  // Pass 1: text size histogram over the whole document (weighted by characters).
  const hist = new Map();
  const raw = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    raw.push({ page, items: tc.items });
    for (const it of tc.items) {
      const chars = (it.str || "").replace(/\s/g, "").length;
      if (!chars) continue;
      const s = r1(Math.hypot(it.transform[2], it.transform[3]));
      hist.set(s, (hist.get(s) || 0) + chars);
    }
  }
  const bodySize = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  for (let n = 1; n <= doc.numPages; n++) {
    const { page, items } = raw[n - 1];
    const [x0, y0, x1, y1] = page.view;
    const width = x1 - x0, height = y1 - y0;
    const lines = toLines(items);
    const images = await imageBottoms(page);
    const results = [];
    const add = (level, check, message) => results.push({ level, check, message });

    // Page size
    if (Math.abs(width - LIMITS.pageWidth) > LIMITS.sizeTolerance || Math.abs(height - LIMITS.pageHeight) > LIMITS.sizeTolerance) {
      add("fail", "page-size", `page is ${r1(width)} x ${r1(height)} pt, expected 612 x 792 (US Letter)`);
    }

    // Font sizes
    const sizes = lines.flatMap((l) => l.sizes);
    const minSize = sizes.length ? Math.min(...sizes) : null;
    if (minSize !== null && minSize < LIMITS.minAnySize) {
      const small = lines.find((l) => l.sizes.includes(minSize));
      add("fail", "min-font", `text at ${r1(minSize)}pt (below ${LIMITS.minAnySize}pt): "${small.text.slice(0, 40)}"`);
    }

    // Blank space below the last content (text or image)
    const textBottom = lines.length ? Math.min(...lines.map((l) => l.y)) : null;
    const imgBottom = images.length ? Math.min(...images.map((i) => i.bottom)) : null;
    const contentBottom = [textBottom, imgBottom].filter((v) => v !== null);
    const lowest = contentBottom.length ? Math.max(y0, Math.min(...contentBottom)) : y1;
    const blank = r1(((lowest - y0) / height) * 100);
    const last = n === doc.numPages;
    const isAppendix = last && lines.some((l) => APPENDIX.test(l.text));
    const failAt = isAppendix ? LIMITS.blankFailAppendix : LIMITS.blankFail;
    const note = isAppendix ? " (final appendix page, fail limit 85%)" : "";
    if (blank > failAt) add("fail", "blank-space", `${blank}% of the page is blank below the last content${note}`);
    else if (blank > LIMITS.blankWarn) add("warn", "blank-space", `${blank}% of the page is blank below the last content${note}`);

    // Card headings on this page
    const headings = lines.map((l) => ({ line: l, name: headingName(l, bodySize) })).filter((h) => h.name);

    // Fragment at page top: a few lines of the previous card, then the next card heading.
    // Counted: card text at or below body size ("Post N" badges and larger section headings are not card text).
    // A hashtag strip that wraps over several lines counts as one line.
    if (n > 1 && headings.length) {
      const first = headings[0].line;
      const above = lines.filter((l) => l.y > first.y + 4 && l.maxSize <= bodySize + 0.5 && !/^(post \d+|\d+)$/i.test(l.text));
      const isTags = (l) => /^(#\S+\s*)+$/.test(l.text);
      const count = above.filter((l, i) => !(isTags(l) && i > 0 && isTags(above[i - 1]))).length;
      if (count > 0 && count < LIMITS.fragmentLines) {
        add("warn", "fragment-top", `page starts with ${count} line(s) of the previous card before "${headings[0].name}": "${above[0].text.slice(0, 40)}"`);
      }
    }

    // Stranded heading: card heading in the bottom 15% of the printable area (inside the @page margins)
    const areaBottom = y0 + LIMITS.marginBottom, areaHeight = height - LIMITS.marginTop - LIMITS.marginBottom;
    for (const h of headings) {
      const pos = (h.line.y - areaBottom) / areaHeight;
      if (pos < LIMITS.strandedZone) {
        add("warn", "stranded-heading", `"${h.name}" heading at ${r1(pos * 100)}% from the bottom of the printable area`);
      }
    }

    pages.push({ page: n, width: r1(width), height: r1(height), minSize: minSize === null ? null : r1(minSize), blank, appendix: isAppendix,
      headings: headings.map((h) => h.name), results });
  }

  const docResults = [];
  if (bodySize && bodySize < LIMITS.minBodySize) docResults.push({ level: "fail", check: "body-font", message: `most common text size is ${bodySize}pt (below ${LIMITS.minBodySize}pt)` });
  const all = [...docResults, ...pages.flatMap((p) => p.results)];
  return { file, pages: doc.numPages, bodySize, docResults, pageResults: pages,
    fails: all.filter((r) => r.level === "fail").length, warns: all.filter((r) => r.level === "warn").length };
}

export function findPdfs(dir) {
  return readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".pdf")).map((f) => join(dir, f).split("\\").join("/")).sort();
}

export function formatReport(rep) {
  const out = [`${rep.file}: ${rep.pages} pages, body text ${rep.bodySize}pt, ${rep.fails} fail, ${rep.warns} warn`];
  for (const r of rep.docResults) out.push(`  ${r.level.toUpperCase()} ${r.check}: ${r.message}`);
  for (const p of rep.pageResults) {
    const status = p.results.some((r) => r.level === "fail") ? "FAIL" : p.results.length ? "WARN" : "ok";
    out.push(`  page ${p.page}: ${status.padEnd(4)} ${p.width}x${p.height}pt, min text ${p.minSize ?? "-"}pt, blank ${p.blank}%${p.appendix ? " (appendix)" : ""}`);
    for (const r of p.results) out.push(`    ${r.level.toUpperCase()} ${r.check}: ${r.message}`);
  }
  return out.join("\n");
}

if (import.meta.url === new URL(process.argv[1], "file:").href || process.argv[1]?.endsWith("check-pdf.js")) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const files = args.filter((a) => a !== "--json").flatMap((a) => (statSync(a).isDirectory() ? findPdfs(a) : [a]));
  if (!files.length) { console.error("usage: node tests/pdf-checks/check-pdf.js [--json] file.pdf ..."); process.exit(2); }
  let failed = false;
  const reports = [];
  for (const f of files) {
    const rep = await checkPdf(f);
    reports.push(rep);
    if (rep.fails) failed = true;
    if (!json) console.log(formatReport(rep) + "\n");
  }
  if (json) console.log(JSON.stringify(reports, null, 2));
  process.exit(failed ? 1 : 0);
}
