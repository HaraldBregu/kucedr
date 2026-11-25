# Bellingcat

Research note for the [product direction](../PRODUCT.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Organisation:** an independent investigative collective, founded in 2014 by Eliot Higgins, who
  chairs its board.
- **Legal entities:** Stichting Bellingcat, a Dutch charitable foundation (registered 2018), and
  Bellingcat US Inc., a US 501(c)(3) (registered 2022).
- **Income:** about half from grants by private and public foundations; the rest from workshops,
  paid keynotes and donations. It received €4.4 million in support in 2023.
- **Government money:** it "does not solicit or accept funding or contributions directly from
  governments". Intergovernmental bodies such as the European Commission are allowed.

## Mission

> "We design and share verifiable methods of ethical digital investigation."

## What they sell

- **Workshops:** public paid courses, private courses with custom content, and courses for
  universities and NGOs. On sale now: an online masterclass on advanced geolocation, 3–4 December
  2026, for €700; a webinar on the command line and AI-assisted coding, 9 December 2026, for €350.
- **Who may attend:** members of police, military or intelligence services may not register;
  government employees are decided case by case.
- **Keynotes and presentations:** paid; prices not stated.
- **Donations:** one-off and recurring gifts, payroll giving and legacies.

## Free tools

- **Auto Archiver:** MIT licence, release 1.2.9 on 1 September 2026. Archives posts, videos,
  images and pages from a command line, a CSV file, Google Sheets or Atlos. Writes SHA-256 hashes,
  signs files with OpenTimestamps, takes full-page screenshots and can save WACZ web archives.
  Stores locally, in S3-compatible buckets or on Google Drive. Runs with Docker or pip. It had
  preserved over 150,000 items by August 2025.
- **Online Investigations Toolkit:** a public directory of tools with guides, Hunchly and Auto
  Archiver among them.

## Compared with Kucedr's direction

- Bellingcat is not a competitor. It sets the methods and the reputation in this field, and its
  workshops train the people Kucedr would sell to. Its rule against police, military and
  intelligence registrants matches the audience in the product direction.
- Auto Archiver already preserves evidence well and for free: hashes, trusted timestamps, WACZ.
  Kucedr's capture records should carry comparable fields, and a WACZ export would let
  Bellingcat-style workflows open them.
- A listing in Bellingcat's toolkit, or free plans for groups like it, would carry more weight with
  journalists than advertising.

## Sources

- [Who we are](https://www.bellingcat.com/about/who-we-are), [general information](https://www.bellingcat.com/about/general-information) and [funding](https://www.bellingcat.com/about/funding-and-how-to-support-bellingcat/), Bellingcat
- [Workshops](https://www.bellingcat.com/workshops/), [geolocation masterclass](https://www.bellingcat.com/workshops/online-masterclass-in-visual-intelligence-the-art-of-advanced-geolocation-2/) and [coding webinar](https://www.bellingcat.com/workshops/command-line-ai-assisted-coding-webinar-2/), Bellingcat
- [Auto Archiver](https://bellingcat.gitbook.io/toolkit/more/all-tools/auto-archiver), Bellingcat's Online Investigations Toolkit
- [Auto Archiver's 150,000 preserved items](https://www.niemanlab.org/2025/08/it-just-got-easier-to-make-an-archival-copy-of-that-website-youre-digging-into/), Nieman Lab, 2025-08
- [Bellingcat](https://en.wikipedia.org/wiki/Bellingcat), Wikipedia
