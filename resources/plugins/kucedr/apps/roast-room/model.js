// Stand-in for roast-room's lib/anthropic.mjs: calls the text model selected in Kucedr.
// The host takes a single prompt, so the system text rides at the top of it.

export const usage = { calls: 0 };
// Reasoning models spend thousands of tokens thinking before they answer; 4096 (the host default) leaves no room.
const MAX_TOKENS = 16000;

export async function text({ system, prompt }) {
  if (!window.models?.text) throw new Error("Open Roast Room in its own window: the in-app view has no model access.");
  usage.calls += 1;
  let out;
  for (let attempt = 0; ; attempt++) {
    try {
      out = await window.models.text.generateText({ prompt: `${system}\n\n---\n\n${prompt}`, maxTokens: MAX_TOKENS });
      break;
    } catch (e) {
      if (attempt >= 5 || !RETRY.test(String(e?.message || e))) throw e;
      await sleep(Math.min(30000, 2000 * 2 ** attempt));
    }
  }
  if (!out.trim()) throw new Error("The text model returned an empty answer. It may have used its whole token budget thinking; try a non-reasoning text model.");
  return out;
}

/** One call whose answer must be a JSON object matching `schema`; retried once if it doesn't parse. */
export async function json({ system, prompt, schema }) {
  const ask = `${prompt}\n\nReply with only a JSON object (no prose, no code fences) matching this JSON schema:\n${JSON.stringify(schema)}`;
  for (let attempt = 0; ; attempt++) {
    const out = await text({ system, prompt: ask });
    try {
      return JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    } catch (e) {
      if (attempt) throw new Error(`The Chair's answer was not valid JSON: ${e.message}`);
    }
  }
}

// JSON schema helpers
export const S = {
  str: { type: "string" },
  num: { type: "number" },
  int: { type: "integer" },
  bool: { type: "boolean" },
  arr: (items) => ({ type: "array", items }),
  obj: (props) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false }),
  enum: (...v) => ({ type: "string", enum: v }),
};
