// Loads a sample report in happy-dom, runs its own inline script, and clicks its Copy buttons
// with the clipboard intercepted. Only used on the sample files in this repo.
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";

// Labels used by the old (round 1) layout, which has no data-key attributes.
const LABEL_KEYS = {
  "email subject line": "subject_line", "subject line": "subject_line", "inbox preview text": "preview_text",
  "email body": "body", "call to action": "cta", "video title": "title", "spoken script": "script",
  "on-screen text overlays": "on_screen_text", "b-roll shot ideas": "b_roll_shot_ideas", "video description": "description",
  "hashtags": "hashtags", "post text": "post", "caption": "caption", "carousel slides": "carousel_slides",
};

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

export async function loadSample(file) {
  const window = new Window({
    url: "https://samples.test/report.html",
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      navigation: { disableMainFrameNavigation: true, disableChildFrameNavigation: true },
    },
  });
  let clip = null;
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async (t) => { clip = t; } }, configurable: true });
  window.isSecureContext = true;
  window.document.write(readFileSync(file, "utf8"));
  await window.happyDOM.waitUntilComplete();
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const press = async (button) => { clip = null; button.click(); await tick(); return clip ?? ""; };

  const cards = [];
  for (const card of window.document.querySelectorAll(".card")) {
    const allButton = card.querySelector('button[data-copy="card"], button[data-copy-card]');
    const copyAll = allButton ? await press(allButton) : null;
    const fields = [];
    for (const f of card.querySelectorAll(".field")) {
      const label = norm(f.querySelector(".label")?.textContent);
      const key = f.getAttribute("data-key") || LABEL_KEYS[label.toLowerCase()] || label.toLowerCase();
      const button = f.querySelector('button[data-copy="field"]');
      const chips = [...f.querySelectorAll(".chip")].map((c) => norm(c.textContent));
      const text = button ? await press(button) : chips.length ? chips.join(" ") : norm(f.querySelector(".copy, .val")?.textContent);
      fields.push({ key, label, all: f.getAttribute("data-all") !== "0", text });
    }
    cards.push({ id: card.id.replace(/^p-/, ""), copyAll, fields });
  }

  const timeline = [...window.document.querySelectorAll(".tl-row")].map((row) => ({
    time: norm(row.querySelector(".tl-t")?.textContent ?? row.querySelector(".tl-time")?.textContent),
    phase: norm(row.querySelector(".tl-ph")?.textContent),
  }));

  await window.happyDOM.close();
  return { cards, timeline };
}

// What Copy all must and must not contain, per platform (brief, Section 5b).
export const COPY_RULES = {
  linkedin: { required: [["post", "content", "post_content", "post_body"], ["hashtags"]], excluded: ["carousel_slides"] },
  instagram: { required: [["caption"], ["hashtags"]], excluded: ["reel_hook", "production_notes", "notes"] },
  youtube_shorts: { required: [["title"], ["description"], ["hashtags"]], excluded: ["script", "spoken_script", "on_screen_text", "on_screen_overlays", "b_roll_shot_ideas", "b_roll_ideas"] },
  email_newsletter: { required: [["subject_line"], ["preview_text"], ["body", "content"], ["cta"]], excluded: [] },
};

const contains = (haystack, needle) => {
  const n = norm(needle).slice(0, 50);
  return n.length > 0 && norm(haystack).includes(n);
};

// Copy all findings for one card, as short strings like "linkedin includes carousel_slides".
export function copyAllFindings(card) {
  const rules = COPY_RULES[card.id];
  if (!rules || card.copyAll === null) return [];
  const found = [];
  for (const key of rules.excluded) {
    const f = card.fields.find((x) => x.key === key);
    if (f && contains(card.copyAll, f.text)) found.push(`${card.id} includes ${key}`);
  }
  for (const group of rules.required) {
    const f = card.fields.find((x) => group.includes(x.key));
    if (f && !contains(card.copyAll, f.text)) found.push(`${card.id} missing ${f.key}`);
  }
  const labels = card.fields.map((f) => f.label.toLowerCase()).filter(Boolean);
  if (card.copyAll.split("\n").some((line) => labels.includes(norm(line).toLowerCase()))) found.push(`${card.id} labels on clipboard`);
  return found;
}

// Timeline findings: a phase with stray punctuation or a leftover lead-in, or a time label holding the whole raw string.
export function timelineFindings(rows) {
  const found = new Set();
  for (const { time, phase } of rows) {
    if (phase && (/^[\s,;:.–—()-]/.test(phase) || phase.includes(" ,") || /^appears? at\b/i.test(phase))) found.add("stray-phase");
    if (/[a-rt-z]/i.test(time) || time.length > 12) found.add("raw-time");
  }
  return [...found];
}
