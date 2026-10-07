# Web use cases

These are three different tools. **Search** returns result metadata from the selected Brave or Tavily engine; **fetch** extracts text from a known public URL; **browser** interacts with a visible page. See [built-in tools](../FEATURES.md#built-in-tools).

## Search with a configured search engine

1. Save a Brave or Tavily key under **Settings → Providers → Search engines** and select it in Agent settings.
2. Send: “Use web search to find the official documentation for the latest stable release of `<PUBLIC_PROJECT>`. Return the result titles and URLs, then tell me which is the official source.”

**Pass:** Tool activity shows `search_web` and results with titles, URLs, and descriptions. A chat model's unaided answer does not pass this test.

## Extract a known page (basic scraping)

1. Choose a public, static HTML or JSON URL that you control or can reuse for testing.
2. Send: “Fetch `<PUBLIC_URL>` with `fetch_web_page`. Extract its page title or one known field, quote a short matching fragment, and report the final URL. Do not use search results as the page content.”

**Pass:** Tool activity shows `fetch_web_page`; the returned URL, status, and extracted text support the answer. This fetcher strips HTML tags and truncates long text. It does not execute page JavaScript or crawl a site.

## Navigate an interactive page

1. Choose a public test page with a harmless button, search field, or navigation link.
2. Send: “Use the web browser to open `<PUBLIC_URL>`, take a page snapshot, click `<HARMLESS_CONTROL>`, and tell me what changed. Do not submit personal data.”

**Pass:** Tool activity shows `use_web_browser` open/navigation, snapshot, and an interaction. The answer describes the observed state after the action. Close the test tab or browser session afterward.
