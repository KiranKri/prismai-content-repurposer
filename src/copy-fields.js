// "Copy all" field selection, extracted from the report builder (Run Function 36) as a pure module.
// In the live report the logic is split in two:
//   - server side, field() marks production-note fields with data-all="0" (NOT_IN_ALL below, copied unchanged);
//   - in the browser, the Copy all click handler in clientMain() joins the plain text of every field in the
//     card that has a Copy button and is not data-all="0", separated by a blank line.
// This module reproduces both steps on plain data so they can be unit tested.

// Fields that "Copy all" skips: production notes, not post text (each still has its own Copy button)
var NOT_IN_ALL = /^(carousel_slides|script|spoken_script|hook_line|thumbnail_text|thumbnail|thumbnail_idea|notes|production_notes|caption_overlays|text_overlays|reel_hook|on_screen_text|on_screen_overlays|b_roll_shot_ideas|b_roll_ideas|sound_strategy|usage_tip|usage_tips|suggested_subreddits|subreddit_details|first_comment_text|seo_meta_description)$/;

// Fields rendered without a Copy button (field() in the builder), so Copy all skips them too.
const NO_COPY_BUTTON = new Set(["subreddit_details", "usage_tip", "usage_tips"]);

// The data-all flag the builder writes for a field key: false means data-all="0".
export function inCopyAll(key) {
  return !NOT_IN_ALL.test(key);
}

export function hasCopyButton(key) {
  return !NO_COPY_BUTTON.has(key);
}

// Plain text of one field value, as the field's own Copy button produces it.
// Hashtags become "#tag #tag" (chips joined by a space); other lists are joined by blank lines.
export function fieldValueText(key, value) {
  if (value == null) return "";
  if (key === "hashtags") {
    const tags = Array.isArray(value) ? value : String(value).split(/[\s,]+/);
    return tags
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => (t.charAt(0) === "#" ? t : "#" + t.replace(/^#+/, "")))
      .join(" ");
  }
  if (Array.isArray(value)) return value.map((v) => fieldValueText("", v)).filter(Boolean).join("\n\n");
  if (typeof value === "object") return Object.values(value).map((v) => fieldValueText("", v)).filter(Boolean).join("\n\n");
  return String(value).trim();
}

// Card fields -> the fields Copy all keeps. Each field is { key, all, copyButton, text }.
// all and copyButton default to what the builder would render for that key.
export function selectCopyAllFields(fields) {
  return fields.filter((f) => {
    const all = f.all ?? inCopyAll(f.key);
    const button = f.copyButton ?? hasCopyButton(f.key);
    return all && button && String(f.text ?? "").trim() !== "";
  });
}

// Card fields -> the exact Copy all clipboard text: values only, no labels, joined by blank lines.
export function copyAllText(fields) {
  return selectCopyAllFields(fields).map((f) => String(f.text).trim()).join("\n\n");
}

// Convenience: a platform object from the final report ({ key: value }) -> Copy all text.
export function copyAllForPlatform(platform) {
  return copyAllText(Object.keys(platform).map((key) => ({ key, text: fieldValueText(key, platform[key]) })));
}

export { NOT_IN_ALL };
