/**
 * Few-shot example templates (Phase E3) — DATA, not logic.
 *
 * Consumed by PromptLearningStore.renderFewShotBlock(), which substitutes the
 * `{{examples}}` / `{{raw}}` / `{{enhanced}}` placeholders. Prompt text belongs
 * in core/prompts/ (repo convention) so prompt changes are reviewable
 * separately from selection logic. NOTE: any change here alters the rendered
 * few-shot block but NOT the cache stamp (which hashes example content only) —
 * if a change should invalidate cached responses, it must be accompanied by an
 * OPTIMIZER_PROMPT_VERSION bump in SystemPrompts.ts.
 */

/**
 * Template for the whole few-shot block appended to the optimizer input
 * (after the existing context/catalog/guidance). `{{examples}}` is replaced
 * with the per-example renderings joined by a blank line.
 */
export const FEWSHOT_BLOCK_TEMPLATE = [
  "### Accepted Prompt Examples (few-shot)",
  "",
  "Real (raw → enhanced) prompt pairs the user explicitly accepted in this",
  "workspace. Treat them as style and quality references for the rewrite",
  "below — examples, not rules; do not copy their content.",
  "",
  "{{examples}}",
].join("\n");

/** Template for one example; `{{raw}}` and `{{enhanced}}` are substituted. */
export const FEWSHOT_EXAMPLE_TEMPLATE = [
  "#### Example",
  "Raw prompt:",
  "{{raw}}",
  "Accepted enhanced prompt:",
  "{{enhanced}}",
].join("\n");
