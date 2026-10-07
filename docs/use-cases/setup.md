# Setup and settings use cases

Use a fresh test profile for first-run scenarios so existing conversations and credentials are unaffected. The [Start flow](../ui/START.md) defines required and optional stages.

## Finish first run without an account

1. Open Kucedr with a fresh test profile, choose **Get started**, then **Skip and continue** on Account.
2. Save a valid model-provider key. Continue past the optional Search providers stage.
3. Select an Assistant provider and model, then choose **Finish**.

**Pass:** Home opens and a short chat request succeeds. Typing a key without saving it should not satisfy the Model stage. Account sign-in is optional; configured model requests still use the selected provider.

## Configure a search engine separately

1. In **Settings → Providers → Search engines**, save a Brave or Tavily key.
2. In Agent settings, select that search service. Return to Settings and confirm the selection persisted.
3. Run the [web search scenario](web.md#search-with-a-configured-search-engine).

**Pass:** The selected service remains saved and `search_web` executes. A saved search key alone does not prove the assistant selected that engine.

## Switch a media model

1. In Agent settings, select an executable Image, Video, or Audio model for which you have credentials.
2. Leave Settings and return to confirm the chosen provider/model remains selected.
3. Run its matching [media scenario](media.md).

**Pass:** The model selection persists and the resulting tool call uses the configured service. Record the exact model ID; a catalog-only model is not a valid execution test.

## Change language and theme

1. In **Settings → Settings**, switch between light and dark themes, then choose the system theme.
2. Change the application language between English and Italian and reopen Home and Settings.

**Pass:** The visible theme changes, system mode follows the operating-system choice, and the main navigation uses the selected language where translations exist. Restore your preferred settings afterward.
