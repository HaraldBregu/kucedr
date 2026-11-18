---
name: doc-coauthoring
description: Staged procedure for writing a long document together with the user. Gathers context and the intended reader, agrees an outline, drafts one section at a time into a Markdown file, then tests the draft as a cold reader (optionally with a subagent that sees only the document) and fixes what was misunderstood. Use when the user wants to write a proposal, design document, specification, report, decision memo, guide, README, or any multi-section document where structure and reader comprehension matter.
license: MIT
---

# Document co-authoring

Write the document in four stages: context, outline, drafting, reader test. Do not draft before the outline is agreed. Tell the user which stage you are in, and let them skip a stage if they ask.

The document lives in one Markdown file from the start. Create it with `write`, and change it afterwards with `edit` so the user's own changes to the file are preserved. Before each round of edits, `read` the file again in case the user changed it.

## Stage 1: Context

Find out what you need to know before any structure exists. Ask with `ask`, in one batch of at most five questions, only for what you cannot infer:

1. Reader: who will read this, what they already know, and what they do not.
2. Outcome: what the reader should decide, do, or understand after reading.
3. Kind and length: the type of document, any template or house format, and the expected length.
4. Material: notes, earlier drafts, data, links, or files to build on.
5. Constraints: deadline, tone, things that must or must not be said.

Then collect the material:

- `read` every file the user points to. Use `fetch_web_page` for links and `query_knowledge` if the user has a knowledge base on the topic.
- Ask the user to tell you everything relevant in whatever order it comes to mind. Do not ask them to organise it; that is your job.
- Keep a list of facts you still need. Ask for them when the list reaches three or four items, not one at a time.

Finish the stage by writing back a short brief and getting a yes:

```
Reader: ...
They already know: ...
After reading they should: ...
Document type and length: ...
Must include: ...
Open questions: ...
```

## Stage 2: Outline

1. Propose the section list. For each section give its heading, one sentence stating the point it makes, and a rough length.
2. Order sections by what the reader needs first, not by the order the work was done. Put the conclusion or request near the top unless the format forbids it.
3. Mark sections where you lack material as `needs input` and say what is missing.
4. Ask the user to add, remove, merge, or reorder. Repeat until they accept.
5. `write` the file with the title, the agreed headings, and a one-line placeholder under each, for example `_To write: why the current process fails._`

## Stage 3: Draft section by section

Start with the section that has the most uncertainty or carries the main argument, not necessarily the first. Leave the summary and introduction for last; they describe the rest.

For each section:

1. If material is missing, ask two or three specific questions first.
2. Write the section into the file with `edit`, replacing its placeholder.
3. Tell the user which section changed and give its main point in a sentence or two. Do not paste the whole section into the chat; they can read the file.
4. Ask for feedback and apply it with targeted edits. Do not rewrite the parts they did not comment on.
5. When they accept it, move on. Note any preference they showed (terms, tone, level of detail) and apply it to later sections without being told again.

Writing rules for every section:

- Lead each section with its point. Supporting detail follows.
- Define a term the first time it appears, and use the same term for the same thing throughout.
- Prefer concrete statements: numbers with units, names, dates, examples. Replace "significant improvement" with the measured figure.
- State each fact once. Refer back instead of repeating.
- Cut any sentence the reader would not miss.
- Never invent facts, figures, quotes, or references. Where something is unknown, write `[TODO: ...]` and list it at the end of the turn.

When all sections are accepted, read the whole file once for flow: repeated points, contradictions between sections, terms that drifted, a section that no longer fits the outline. Fix them, then write the summary and introduction.

## Stage 4: Reader test

The aim is to find what a reader with none of this conversation's context will misread.

1. Write 5 to 8 questions the intended reader would need the document to answer. Include the purpose, the main recommendation or conclusion, what they must do next, and one or two questions of detail.
2. Run the test with a single `subagent` task. The subagent has no access to this conversation, which is what makes it a fair reader. Use this prompt, with the path and questions filled in:

```
Read the file at [absolute path] with the read tool. You know nothing about it except what the file says.
You are [the intended reader, in one sentence].
Answer each question using only the document:
[numbered questions]
Then list:
- Terms or abbreviations used without explanation.
- Statements that seem to contradict each other.
- Places where you had to guess what the author meant, and what you guessed.
- Anything you expected to find and did not.
Do not suggest rewrites. Do not edit the file.
```

3. If `subagent` is unavailable, do the test yourself: re-read the file from the top, and for each question point to the sentence that answers it. A question you can answer only from the conversation is a failure.
4. Compare the answers with what the user meant. Each wrong, vague, or guessed answer marks a defect in the document, not in the reader.
5. Show the user the list of defects, then fix each with `edit`. Re-run the test only on the questions that failed.

## Finish

Report in this form:

```
File: [path]
Sections: [count], about [n] words
Reader test: [n] of [n] questions answered correctly after fixes
Still open: [each remaining TODO or unconfirmed fact, or "none"]
```

Do not call the document finished while any `[TODO]` marker remains, unless the user chose to leave it.
