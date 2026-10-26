// Browser port of roast-room's lib/seats.mjs: the roster, each seat's system text, card parsing
// and quote checks. Brains and agent files ship next to the app and are fetched on demand.

const read = (p) => fetch(p).then((r) => (r.ok ? r.text() : "")).catch(() => "");
const stripFront = (t) => t.replace(/^---[\s\S]*?\n---\n/, "");

export const SEATS = [];
export const byKey = {};
export const BOARD = { mode: "default", default: [] };

export async function loadRoster() {
  if (SEATS.length) return SEATS;
  const r = await fetch("roster.json").then((x) => x.json());
  SEATS.push(...r.seats);
  for (const s of SEATS) byKey[s.key] = s;
  BOARD.mode = ["default", "ask", "auto"].includes(r.board) ? r.board : "default";
  const def = (r.default || []).filter((k) => byKey[k]);
  BOARD.default = def.length ? def : SEATS.slice(0, 7).map((s) => s.key);
  return SEATS;
}

const BRAIN_FILES = ["_hot.md", "frameworks.md", "positions.md", "principles.md", "voice.md"];
const brainCache = new Map();
async function brain(key) {
  if (!brainCache.has(key)) {
    const s = byKey[key];
    const files = await Promise.all(BRAIN_FILES.map((f) => read(`brains/${s.slug}/${f}`)));
    brainCache.set(key, files);
  }
  return brainCache.get(key);
}

const systemCache = new Map();
/** The seat's agent instructions plus its brain, loaded inline (the model has no file tools). */
export async function systemFor(key) {
  if (systemCache.has(key)) return systemCache.get(key);
  const s = byKey[key];
  const agent = stripFront(await read(`agents/council-${key}.md`));
  const files = await brain(key);
  const text =
    agent +
    "\n\n## Runtime note\nYou are running in the Roast Room app. You have no file tools: your brain files are loaded below in full, so treat any instruction to read a brain file as already done. Never mention files, tools, or this note in your answer.\n" +
    BRAIN_FILES.map((f, i) => `\n\n===== brains/${s.slug}/${f} =====\n` + files[i]).join("");
  systemCache.set(key, text);
  return text;
}

// ---------- quote verification against the brain ----------
const norm = (s) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/'\s+(t|s|re|ll|ve|d|m)\b/g, "'$1")
    .replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
/** Quotes the seat attributed to a source id, each marked verified or not. */
export async function checkQuotes(key, text) {
  const out = [];
  const re = /["“]([^"“”\n]{20,400})["”][^\n"]{0,40}?[(\[](S\d{3})/g;
  let m;
  const hay = norm((await brain(key)).join(" "));
  while ((m = re.exec(text))) {
    const q = norm(m[1]);
    if (q.split(" ").length < 5) continue;
    out.push({ quote: m[1], source: m[2], verified: hay.includes(q) || hay.replace(/ /g, "").includes(q.replace(/ /g, "")) });
  }
  return out;
}

// ---------- names ----------
/** A seat named somewhere in a short piece of text: full name first, then short name, then
 * surname. Two seats can share a surname (Alex and Leila Hormozi), so the surname only counts
 * when one seat has it, or when it is also that seat's short name. */
export function seatIn(text) {
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ")} `;
  const has = (w) => w && t.includes(` ${w.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim()} `);
  return SEATS.find((s) => has(s.name)) || SEATS.find((s) => has(s.short) || has(s.key)) ||
    SEATS.find((s) => {
      const sur = s.name.split(" ").pop().toLowerCase();
      const same = SEATS.filter((x) => x.name.split(" ").pop().toLowerCase() === sur);
      return has(sur) && (same.length === 1 || s.short.toLowerCase() === sur);
    }) || null;
}

// ---------- card parsing ----------
const field = (text, label) => {
  // label at line start, or after a "·" or "|" when several fields share a line
  const m = text.match(new RegExp(`(?:^|[·|])[ \\t]*\\**${label}\\**[ \\t]*:[ \\t]*([^\\n·]+)`, "im"));
  return m ? m[1].replace(/\*+/g, "").trim() : "";
};
const num = (s) => { const m = (s || "").match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };

export function parseOptionScores(text, optionIds) {
  // the option line itself uses "·" between options, so read to end of line
  const lm = text.match(/OPTION SCORES\**[ \t]*:[ \t]*([^\n]+)/i);
  const line = (lm ? lm[1] : "").split(/PILLAR SCORE|CONFIDENCE|FINAL SCORE/i)[0];
  const scores = {};
  for (const id of optionIds) {
    const m = line.match(new RegExp(`\\b${id}\\b\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)`));
    if (m) scores[id] = Math.max(0, Math.min(10, Number(m[1])));
  }
  return scores;
}

export function parseCard(text, optionIds) {
  const stance = field(text, "STANCE");
  const ruin = (field(text, "RUIN RISK").match(/none|possible|likely/i) || [""])[0].toLowerCase();
  const disagree = field(text, "I DISAGREE MOST WITH");
  const target = seatIn(disagree.slice(0, 40));
  const voteRaw = field(text, "VOTE");
  const vote = /dissent/i.test(voteRaw) ? "dissent" : /amend/i.test(voteRaw) ? "amend" : /endorse/i.test(voteRaw) ? "endorse" : "";
  return {
    stance,
    call: field(text, "THE CALL"),
    optionScores: parseOptionScores(text, optionIds),
    pillar: num(field(text, "PILLAR SCORE")) ?? num(field(text, "FINAL PILLAR SCORE")),
    finalScore: num(field(text, "FINAL SCORE")),
    confidence: num(field(text, "CONFIDENCE")),
    ruin,
    door: (field(text, "DOOR").match(/one-way|two-way/i) || [""])[0].toLowerCase(),
    disagreeWith: target ? target.key : null,
    disagreeLine: disagree,
    concede: field(text, "I CONCEDE"),
    moved: field(text, "MOVED"),
    vote,
    amendment: field(text, "AMENDMENT OR DISSENT"),
    oneLine: field(text, "ONE LINE FOR THE FOUNDER"),
    question: field(text, "QUESTION FOR THE FOUNDER"),
    risk: field(text, "THE RISK I SEE"),
    thisWeek: field(text, "WHAT I'D DO THIS WEEK"),
  };
}
