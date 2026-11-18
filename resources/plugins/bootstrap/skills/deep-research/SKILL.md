---
name: deep-research
description: Multi-source research procedure that produces a cited Markdown report. Clarifies the question, splits it into sub-questions, fans the searching out to parallel subagents using search_web and fetch_web_page, cross-checks every important claim against primary sources, and saves the report with write. Use when the user asks for research, a literature or market overview, a comparison of options, a fact-finding report, or any question that needs several independent sources and citations rather than a quick answer.
license: MIT
---

# Deep research

Produce a report in which every important claim is traceable to a source the user can open. A short report with verified claims beats a long one with unverified ones.

## Before you start

- `search_web` exists only when the user has configured a search engine. If it is not among your tools, say so and offer to work from URLs the user supplies, using `fetch_web_page` alone.
- `fetch_web_page` returns text, HTML converted to text, and JSON. It cannot read PDFs or other binary files, and it does not run JavaScript. It returns 20,000 characters by default and sets `truncated: true` when it cut the page; raise `maxChars` to read further.
- If the user has a knowledge base and the topic may be covered there, run `query_knowledge` first and treat its results as one more source.

## Step 1: Pin down the question

Restate the question in one sentence. If any of these is unknown and would change the research, put them in a single `ask` call; otherwise state your assumption and continue:

- Scope: region, time period, industry, or product category.
- Purpose: what decision or document the report feeds.
- Depth: a one-page brief or a full report.
- Sources to prefer or exclude.

## Step 2: Split into sub-questions

Write 3 to 7 sub-questions that together answer the main question. Each must be answerable on its own and must not overlap its neighbours. Include at least one that looks for disagreement: criticism, counter-evidence, or failed cases.

Show the list to the user in one short message and proceed without waiting, unless they asked to approve the plan.

## Step 3: Fan out with subagents

Call `subagent` with two or three tasks per call so they run concurrently; repeat the call for the remaining sub-questions. Facts that shape the prompts:

- A subagent starts with an empty context. It does not see this skill, the conversation, or earlier results. Everything it needs must be in its `task` text.
- Two or three tasks in one call run in parallel with read-only tools, which include `search_web`, `fetch_web_page` and `read`. They cannot write files or run commands.
- A subagent cannot spawn its own subagents, and cannot ask the user anything.
- Each returns one summary of at most 12,000 characters. Ask for a compact, structured answer.
- One failed task does not cancel the others. Check each result's `status`; re-run a `failed` or `exhausted` task once with a narrower scope, then cover it yourself.

Give each task a stable `id` (for example `q1-market-size`) and a `task` built from this template, with every bracket filled in:

```
Research question: [one sub-question, self-contained, with region and date range]
Background you need: [2-4 sentences: the overall topic, terms defined, what is already known]
Out of scope: [what the other subagents are covering, so you do not repeat it]

Method:
1. Run 3-6 searches with search_web, varying the wording. Use count 8-10.
2. Open the most relevant results with fetch_web_page. Read the page; do not rely on the search snippet.
3. Prefer primary sources: official statistics, standards, filings, papers, documentation, the organisation's own statement. Follow a secondary article back to the source it cites and fetch that.
4. If a page is truncated and the part you need is missing, fetch it again with a larger maxChars.

Return exactly this, and nothing else:
- Answer: 3-6 sentences.
- Findings: a list. For each finding give
  - Claim: one sentence.
  - URL: the exact page you fetched.
  - Quote: the passage that supports the claim, copied word for word, at most 60 words.
  - Source type: primary / secondary / opinion.
  - Date: publication or last-updated date, or "undated".
- Conflicts: places where sources disagree, with both URLs.
- Not found: what you looked for and could not confirm.
Do not state anything you did not read on a fetched page. Do not invent URLs.
```

## Step 4: Cross-check

Build a claim table from the returned findings, then verify before writing:

1. For every claim the report's conclusion depends on, fetch the URL yourself with `fetch_web_page` and confirm the quote is on the page and says what the claim says. Drop or reword any claim whose quote you cannot find.
2. A number needs a primary source, or two independent secondary sources that do not cite each other. Record the unit, the date, and what was measured.
3. When sources conflict, do not average them. Find out why (different date, definition, or sample) and report both with the reason. If you cannot tell why, say so.
4. Mark each claim: `confirmed` (primary source or two independent sources), `single source`, or `disputed`.
5. If a sub-question is still thin, run one more targeted `subagent` call or search it yourself. Stop after two rounds and report the gap instead of padding.

## Step 5: Write the report

Save it with `write` as Markdown, named after the topic (for example `research-heat-pump-costs.md`) in the workspace unless the user named a location. Use this structure:

```
# [Title phrased as the question]

Date: [today]  |  Scope: [region, period, exclusions]

## Summary
[5-8 sentences that answer the question directly. Each factual sentence carries a citation.]

## Findings
### [Sub-question 1]
[Prose. Citations inline as [1], [2]. Say when a claim rests on a single source.]

## Where sources disagree
[Each conflict, both positions, and the likely reason.]

## Gaps and confidence
[What could not be confirmed, what is out of date, and how sure the conclusion is.]

## Sources
1. [Title] - [Publisher], [date]. [URL]
```

Rules for the text:

- Every factual sentence has a numbered citation. A sentence you cannot cite is either labelled as your inference or removed.
- Number sources in order of first use. List only sources you cited, with the URL that was fetched.
- Quote sparingly and exactly. Paraphrase the rest.
- Keep your own analysis in clearly worded sentences ("This suggests...") so the reader can tell it from sourced fact.
- Give dates for anything that changes over time: prices, versions, laws, statistics.

## Step 6: Report back

Tell the user the file path, the answer in three sentences or fewer, the number of sources cited, and the most important gap or disputed point. Do not paste the whole report into the chat unless asked.
