# OpenOSINT

Research note for the [product direction](PRODUCT.md). Read 2026-11-25 from the sources at the end.
"Not stated" means the pages read did not say.

## At a glance

- **Maintainer:** Tommaso Bertocchi ("SonoTommy"), under the OpenOSINT organisation on GitHub. No
  company, country or founding year is stated.
- **Product:** an open-source OSINT agent with a command line, a web interface, an MCP server and
  a Claude Code plugin.
- **Licence:** MIT; "free and open source under the MIT License for any use" (COMMERCIAL.md). A
  PyPI page was reported to ask for a separate licence for closed-source commercial use; it could
  not be read to confirm.
- **Activity:** the organisation was last updated on 15 November 2026. Several forks copy the
  project with different tool counts.

## Mission

> "an open-source OSINT agent for investigators and security researchers"

## What they sell

- The software is free.
- **OpenOSINT Cloud:** a hosted version, "First check free, no account"; plan prices not stated.
- **Commercial plans:** Starter €300 a year, Business €600 a year, Enterprise from €1,000 a year.
  What they add beyond the MIT software is not stated on the pages read.

## How it works

- 21 public-source tools behind natural-language chat; 9 need an API key. Passive by default, no
  keys needed to start.
- "No LLM is embedded": the MCP client brings the model. Earlier versions advertised Claude, GPT-4
  and Ollama.
- "every finding cites the call that produced it". Hashing, timestamps and exports are not stated.
- Allowed use: "legitimate security research, ethical OSINT investigations, and educational
  purposes only". Unauthorised surveillance, stalking and harassment are prohibited; there is no
  user vetting.

## Compared with Kucedr's direction

- Kucedr already runs local MCP servers, so a user could connect OpenOSINT today and give the agent
  its tools. Bundling it is different: the product direction keeps people-search connectors out, so
  its tools need checking first.
- It shows the open-source route: free software, a hosted service and commercial plans from €300 a
  year.
- What it lacks is what Kucedr would add: a browser, capture records, case files and a report.

## Sources

- [OpenOSINT](https://github.com/OpenOSINT/OpenOSINT), [COMMERCIAL.md](https://github.com/OpenOSINT/OpenOSINT/blob/main/COMMERCIAL.md) and [DISCLAIMER.md](https://github.com/OpenOSINT/OpenOSINT/blob/main/DISCLAIMER.md), GitHub
- [OpenOSINT v2 announcement](https://github.com/OpenOSINT/OpenOSINT/discussions/2), GitHub
- [I built an MCP-native OSINT framework](https://dev.to/sonotommy/i-built-an-mcp-native-osint-framework-that-lets-ai-agents-investigate-from-your-terminal-4768), DEV Community
- [openosint on PyPI](https://pypi.org/project/openosint/2.19.1/)
