# Commercial research for a company briefing desk

**Proposed mission:** Help independent analysts turn company research into client briefs that another person can verify.

This research, dated 25 November 2026, narrows the investigation desk proposed in the product mission to one initial market. The user is an analyst at a boutique due-diligence firm checking suppliers or business partners. The buyer is the firm owner who pays for research, review, and revisions. The commercial question is whether Kucedr can reduce the time spent verifying a bespoke brief enough for that firm to pay for it. [Product direction](PRODUCT.md)

## The first client brief

A client asks, “This supplier says it operates two factories. What can we independently confirm?” The analyst adds the supplier’s brochure to a case, examines public filings and web pages, then drafts a brief. It distinguishes the supplier’s claim, the facts an independent source confirms, and the questions still open. The analyst edits the conclusion and exports it.

The decisive test comes a week later. A reviewer questions one sentence after the supplier has updated its website. Can the reviewer open the saved passage or page as the analyst saw it, check what it supports, and approve or correct the sentence?

A field study at one commercial intelligence firm documented duplicate collection and report writing, with PDFs difficult to locate or identify. Greenberg Corporate Intelligence describes selling tailored due-diligence reports based in part on public records and online research. These sources establish a workflow and a plausible cost. Willingness to pay for Kucedr still needs a paid trial. [Field study](https://link.springer.com/article/10.1007/s42488-022-00068-4) · [Greenberg Corporate Intelligence](https://www.greenbergintel.com/due-diligence)

## What the implementation supports

| Workflow | Current implementation | Work needed for the brief |
| --- | --- | --- |
| Collect | The browser saves screenshots and page PDFs. Its result identifies the tab and file. [Browser implementation](../../src/main/agent/tools/web/browser/run.ts) | Save the source URL, capture time, and content hash with the artifact. Give the report a durable reference to it. |
| Draft and review | Knowledge search returns excerpts with paths and line references. The research skill guides cross-checking and cited drafting, and Workspace supports export. [Knowledge query](../../src/main/agent/tools/knowledge/query_knowledge.ts) · [Research skill](../../resources/plugins/bootstrap/skills/deep-research/SKILL.md) · [Workspace export](../../src/renderer/src/pages/workspace/Actions.tsx) | Let a reviewer inspect a claim beside its preserved source, correct it, and keep that connection in the exported brief. |
| Separate clients | The app resolves one workspace. The proposed workspace design shares chats, memory, and Library. Browser routing and disclosure to a model provider are separate choices. [Workspace location](../../src/main/shared/agent_location.ts) · [Workspace proposal](../WORKSPACES.md) · [Browser routes](../BROWSER_ROUTES.md) | Scope chats, captures, and retrieval to the case and show where its content can be sent before handling confidential client material. |

The review included six passing unit tests covering capture output and knowledge-query behavior. They used mocked browser and retrieval dependencies. Completing a live case with a model, exporting it, and having a second analyst verify it remains an acceptance test for the proposed product.

## Commercial alternatives

| Product direction | Comparable offerings observed on 25 November 2026 | Implication for Kucedr |
| --- | --- | --- |
| Company-research and briefing desk | NC Data offers analyst-reviewed findings and standard company reports from €22.50 plus VAT per report. [NC Data](https://ncdata.eu/) | Test bespoke briefs that answer a client’s specific question using the firm’s sources and report format. A standard company profile already has a low price anchor. |
| General investigation workbench | Hunchly Classic lists local investigation storage at €149/year. Trace advertises local cases and hashed captures. OSINT Copilot combines local evidence, browser capture, and optional AI. [Hunchly](https://hunch.ly/pricing) · [Trace](https://www.traceosint.com/) · [OSINT Copilot](https://github.com/OSINT-Copilot/osint-copilot) | These offerings challenge the original proposal’s competitive premise. Local storage, evidence capture, and model choice already exist together. Measure the improvement on a real assignment. |
| Competitive-monitoring service | Visualping sells scheduled, AI-summarized change reports on business plans from $1,200/year. Kucedr’s current scheduler depends on the app running. [Visualping](https://visualping.io/blog/competitive-intelligence-reports-without-enterprise-platform) · [Automation roadmap](../roadmap/AUTOMATION.md) | Consider monitoring if clients repeatedly ask what changed since the previous brief. Launching with it would make reliable unattended checks the first engineering requirement. |

## Paid pilot and decision criteria

1. Recruit five boutique firms. Ask each for a completed, redacted brief. Observe how the analyst assembled it and time a reviewer locating the support for three claims. Record which sources remain recoverable.
2. Demonstrate one public supplier case. Start with “Create a company brief.” Have a second person inspect a preserved source from the export and explain why one finding remains unresolved. Keep onboarding focused on completing this task.
3. Offer a €250 assisted pilot per firm for setup, one report template, and two public or redacted briefs. This price is an experiment. It can be tested before investing in subscriptions or hosted storage. [Payments roadmap](../roadmap/PAYMENTS.md)

Proposed thresholds are two of five firms paying, at least 30% faster review with comparable accuracy, and one firm asking to use Kucedr on a third assignment. If reviewers spend substantial time reconstructing sources, prioritize case isolation, source preservation, and report review. If obtaining proprietary records consumes most of their time, revisit the product direction before investing in case management.
