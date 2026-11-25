# Commercial research for a company briefing desk

**Proposed mission:** Help independent analysts turn company research into client briefs that another person can verify.

This research, dated 25 November 2026, narrows the investigation desk proposed in the product mission to one initial market. The user is an analyst at a boutique due-diligence firm checking suppliers or business partners. The buyer is the firm owner who pays for research, review, and revisions. The commercial question is whether Kucedr can reduce the time spent verifying a bespoke brief enough for that firm to pay for it. [Product direction](PRODUCT.md) · [How Kucedr competes](COMPETITION.md) · [Margins and unit economics](ECONOMICS.md)

## The first client brief

A client asks, “This supplier says it operates two factories. What can we independently confirm?” The analyst adds the supplier’s brochure to a case, examines public filings and web pages, then drafts a brief. It distinguishes the supplier’s claim, the facts an independent source confirms, and the questions still open. The analyst edits the conclusion and exports it.

The decisive test comes a week later. A reviewer questions one sentence after the supplier has updated its website. Can the reviewer open the saved passage or page as the analyst saw it, check what it supports, and approve or correct the sentence?

A field study at one commercial intelligence firm documented duplicate collection and report writing, with PDFs difficult to locate or identify. Greenberg Corporate Intelligence describes selling tailored due-diligence reports based in part on public records and online research. These sources establish a workflow and a plausible cost. Willingness to pay for Kucedr still needs a paid trial. [Field study](https://link.springer.com/article/10.1007/s42488-022-00068-4) · [Greenberg Corporate Intelligence](https://www.greenbergintel.com/due-diligence)

## What happens when review fails

New Zealand’s Auditor-General examined a procurement in which Callaghan Innovation commissioned due diligence on six shortlisted tenderers and a second round on one. The auditors could not locate interview evidence for a specific serious allegation attributed to interviewees. The reports subsequently reached other organisations. This is evidence of a commissioned workflow and of the cost of losing the connection between an assertion and its basis. It provides no estimate of how often this happens at small firms. [Auditor-General’s inquiry](https://ao.parliament.nz/2023/callaghan-innovation/overview.htm)

For Kucedr, keeping the source file is only half the job. A reviewer needs to see exactly which words support the finding, whose account they represent, and which qualification belongs beside them. That qualification must survive editing and export. Practitioner examples show what the output can look like. Trust Global Intelligence publishes explicitly fictional reports that record the client’s questions, dated enquiries, findings and open questions. Its supplier example distinguishes desk findings from a visit to the site. [Sample reports D and G](https://global.tgi-intel.com/report-sample/)

## A public example anyone can check

Use this question in the demo: *What do public sources establish about MINI manufacturing in Oxford and Swindon?* The table is a human reading of the linked sources on 25 November 2026. It doubles as an answer key for evaluating a future Kucedr brief.

| Finding the brief can support | Evidence a reviewer should reopen | Where the conclusion stops |
| --- | --- | --- |
| BMW describes Oxford as a MINI production site and Swindon as a body-panel manufacturing site. | The company’s dated account names both sites and gives their distinct roles. [BMW Group announcement](https://newsroom.bmwgroup.com/emea/mini-marks-25-years-of-modern-production-with-celebration-of-british-manufacturing-excellence) | Attribute production figures to BMW. A copy of the announcement on another site adds no independent observation. |
| Oxford City Council lists a permitted vehicle-painting installation at Plant Oxford. | The register names the activity and lists the premises, reference and operator. [Oxford permit register](https://www.oxford.gov.uk/environmental-health/industrial-pollution-control) | A permit supports the permitted activity at that site. It does not measure current output. |
| Swindon Borough Council describes its leader’s visit to the MINI plant and observations about automated production. | The council’s October 2026 account identifies the visited site and describes the visit. [Swindon site visit](https://www.swindon.gov.uk/news/article/1436/building_stronger_partnerships_with_one_of_swindons_major_employers) | A visit corroborates activity at that time. Land ownership, current capacity and the identity of a common contracting entity across both sites remain open on these sources. |

The same question can be adapted for an Italian supplier. Registro Imprese explains how to obtain the registered addresses and activities of local units through Telemaco. A firm can bring its own extract and search date to the case. A registered local unit, a working factory, and a factory owned by the contracting entity are three different claims. This is a useful second test of the product across languages and source formats. [Registro Imprese guide](https://www.registroimprese.it/sede-legale-e-unita-locali)

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

**The everyday competitor is the firm’s current Word template and source folder.** An analyst can already preserve webpages and PDFs with Zotero and insert or update citations in Word. Established firms have invested in templates, staff training, and client-specific wording. Give the comparison reviewer the firm’s normal tools, including Zotero if they use it. Ask whether the analyst can deliver in the client’s required editable format before proposing an editor switch. [Zotero capture](https://www.zotero.org/support/attaching_files) · [Zotero Word integration](https://www.zotero.org/support/word_processor_plugin_usage)

**Separate the software budget from the report budget.** OpenDossier lists company intelligence at US$99 per seat per month and a diligence brief from US$1,000 per subject with the workspace included. The first buys recurring access, the second buys an outcome. A consultancy buying Kucedr still supplies the analyst, sources, conclusions and review. Interview the budget owner about the last software purchase and the last report they commissioned separately. [OpenDossier products and pricing](https://www.opendossier.com/product/)

Two additional directions use substantial parts of the current app. Each would require a different first customer and an observable reason to change focus.

| Direction | What Kucedr could reuse | What would justify switching direction |
| --- | --- | --- |
| Proposal and questionnaire response desk for bid teams | Document ingestion, retrieval, an editor and reusable skills fit drafting from a library of previous answers. Loopio already imports requirements, reuses library content and offers multi-step review. [Loopio project workflow](https://support.loopio.com/hc/en-us/articles/360020261634-What-is-a-Project) · [Loopio plans](https://loopio.com/pricing/) | Bid teams provide repeat questionnaires and pay to return a completed original template. Test answer ownership, approval expiry and exact spreadsheet coordinates first. |
| Interview analysis for small research agencies | Recordings, document search and drafting could help turn interview material into findings. Dovetail already links research findings to transcript passages and playable clips. [Dovetail research repository](https://dovetail.com/solutions/research-repository/) | Researchers identify recovering an exact quote across interviews as the costly step. Test a finding that reopens at the correct speaker and timestamp with consent to share the excerpt. |

Company briefs remain the first experiment because the buyer already delivers a document, the buyer’s reviewer can grade it, and public evidence can exercise most of the workflow. The evidence for monitoring, proposal response and interview analysis establishes alternatives. It does not establish that Kucedr has customers in any of them. [Current software assessment](SOFTWARE.md)

## Paid pilot and decision criteria

1. Recruit five boutique firms. Ask each for a completed, redacted brief. Observe how the analyst assembled it and time a reviewer locating the support for three claims. Record which sources remain recoverable.
2. Demonstrate one public supplier case. Start with “Create a company brief.” Have a second person inspect a preserved source from the export and explain why one finding remains unresolved. Keep onboarding focused on completing this task.
3. Offer a €250 assisted pilot per firm for setup, one report template, and two public or redacted briefs. This price is an experiment. It can be tested before investing in subscriptions or hosted storage. [Payments roadmap](../roadmap/PAYMENTS.md)

Proposed thresholds are two of five firms paying, at least 30% faster review with comparable accuracy, and one firm asking to use Kucedr on a third assignment. If reviewers spend substantial time reconstructing sources, prioritize case isolation, source preservation, and report review. If obtaining proprietary records consumes most of their time, revisit the product direction before investing in case management.

### Who to recruit and what to measure

Recruit firms that repeatedly prepare bespoke company briefs, involve a second reader before delivery, and can use a public or redacted assignment. The Association of British Investigators directory includes a due-diligence filter. Use it to identify firms, then qualify them by their published corporate work. Ask the owner who authorises software purchases and ask the reviewer to show the last finding they sent back. A sole practitioner with no reviewer can help test source recovery but cannot validate the two-person handoff. [ABI directory](https://www.theabi.org.uk/membership-search)

Give each firm two comparable questions with known source material and alternate which workflow they use first. A second reader receives only the ordinary deliverables and uses a fresh profile. Time from opening the brief until they can support, correct or reject three assigned claims. Record unresolved claims, incorrect approvals, missing qualifications, installation and preparation time, manual repairs, and any source the reviewer cannot access. For the changed-page exercise, alter a disposable copy of a page after capture. Preserve the originals of the public sources.

Report paired times per firm alongside errors. Faster review counts only if reviewers also catch the unsupported assertion and find the preserved passage. Count assisted sessions separately from independent repeat use. Five firms can expose friction and produce an initial purchase signal. They cannot establish a market-wide conversion rate.

### What the economics would need to look like

Estimate monthly value as briefs per month × minutes saved per brief ÷ 60 × the firm’s hourly labour cost. For illustration, eight briefs saving 20 minutes each at €60/hour free €160 of reviewer capacity. At two briefs per month the same improvement frees €40. These are assumptions, and released time becomes cash value only if the firm can use it. Measure extra analyst preparation too: ten extra minutes of evidence tagging per brief would halve the first example’s net time saving at the same hourly cost.

Keep a second ledger for Kucedr. At the proposed €250 pilot price, four hours of onboarding and support at an assumed €60/hour leave €10 before model, search or payment costs. A firm buying twice because the founder manually finishes every report validates a service. A reviewer returning for a third brief without assistance is stronger evidence for repeatable software revenue. Record those outcomes separately before choosing a subscription price or funding hosted storage.
