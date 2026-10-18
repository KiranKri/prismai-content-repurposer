// Timeline time/phase parser, extracted from the report builder (Run Function 36) as a pure module.
// The function bodies below are copied unchanged from the builder. A parity test in the private source
// repo (tests/builder-parity.test.js) fails if they drift from the builder.

function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === "string") { var t = v.trim(); return t === "" || /^(null|undefined|n\/a|none|\[\]|\{\})$/i.test(t); }
  if (Array.isArray(v)) return v.filter(function (x) { return !isEmpty(x); }).length === 0;
  if (typeof v === "object") return Object.keys(v).filter(function (k) { return !isEmpty(v[k]); }).length === 0;
  return false;
}
function str(v) { return isEmpty(v) ? "" : String(v).trim(); }

// "0-3 seconds, during hook" -> ["0–3s", "During hook"]; "Early — during hook (0–8 sec)" -> ["0–8s", "Early — during hook"]
function timeParts(t) {
  t = str(t); if (!t) return ["", ""];
  var re = /(?:\d{1,2}:)?\d{1,3}(?:\.\d)?\s*(?:s|secs?|seconds)?\s*(?:[–—-]|to)\s*(?:\d{1,2}:)?\d{1,3}(?:\.\d)?\s*(?:s\b|secs?\b|seconds\b)?|(?:\d{1,2}:)?\d{1,3}(?:\.\d)?\s*(?:s\b|secs?\b|seconds\b)|\b\d{1,2}:\d{2}\b/i;
  var m = t.match(re);
  if (!m) return t.length <= 9 ? [t, ""] : ["", cleanPhase(t)];
  var raw = m[0], hasColon = /:/.test(raw);
  var time = raw.replace(/\s*(?:seconds|secs?|s)\b/gi, "").replace(/\s*(?:[–—-]|to)\s*/i, "–").replace(/\s+/g, "") + (hasColon ? "" : "s");
  return [time, cleanPhase(t.slice(0, m.index) + " " + t.slice(m.index + raw.length))];
}
// v7: "Appears at 0-3s, during hook" left "Appears at , during hook"; strip the lead-in and leftover separators
function cleanPhase(p) {
  p = String(p).replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/^\s*(?:(?:appears?|appearing|shown|shows?|showing|starts?|starting|begins?|displayed|on screen)\s*)?(?:at|from|around|between|by|@)?(?=[\s,;:–—()-]|$)/i, "")
    .replace(/\s*([,;:–—-])(?:\s*[,;:–—-])+/g, "$1").replace(/\s+([,;:])/g, "$1")
    .replace(/^[\s,;:–—()-]+|[\s,;:–—(-]+$/g, "").replace(/\s{2,}/g, " ").trim();
  if (/^\)/.test(p) || (/\)$/.test(p) && p.indexOf("(") === -1)) p = p.replace(/^\)\s*|\s*\)$/g, "");
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

// Raw timing string from the model -> { time, phase }.
// time is a short non-wrapping label ("0–3s"), phase a capitalised description or "".
export function parseTiming(raw) {
  const [time, phase] = timeParts(raw);
  return { time, phase };
}

export { timeParts, cleanPhase };
