# Start Page Flow

The start page is Kucedr's single entry point for first-run onboarding and incomplete assistant
configuration. Visible onboarding should remain on `/start` until Kucedr has a stored assistant
provider and model, then open `/home`. A restored signed-in user with incomplete configuration
should see Welcome before setup, without repeating Account.

## Flow at a glance

```text
Open Kucedr
  -> Restore authentication
       -> signed in: check assistant configuration, then Welcome if incomplete
       -> signed out: Welcome -> Account or local-only mode -> check assistant configuration
       -> password recovery: Account -> check assistant configuration
  -> configuration complete: Home
  -> configuration incomplete: Model API keys
       -> Search Engine
       -> Assistant setup
       -> verify configuration
       -> Home
```

The footer presents five visible stages: **Welcome**, **Account**, **Model**, **Search**, and
**Models**. Configuration checks happen between stages and do not
add another progress item.

## Entry and routing

- `/`, `/auth`, `/setup`, and `/config` should resolve to `/start`.
- An application route should show a neutral loading surface while readiness is checked, then
  remain available when setup is complete or redirect to `/start` when setup is incomplete.
- Every onboarding stage should remain on `/start`; changing a stage must not add browser history.
- A ready user who opens an onboarding route should be redirected to `/home`.

## Stage requirements

| Stage   | Expected action                                    | Required to continue |
| ------- | -------------------------------------------------- | -------------------- |
| Welcome | Start the onboarding flow                          | For incomplete setup |
| Account | Sign in, create an account, or continue local-only | No account required  |
| Model   | Save an API key for a catalog model provider       | Yes                  |
| Search  | Connect a web-search provider                      | No                   |
| Models  | Select the primary assistant provider and model    | Assistant only       |

### 1. Welcome

For a user with incomplete setup, the first stage should introduce Kucedr and provide one primary
**Get started** action. While the authentication or configuration state is unresolved, that action
should be disabled and labeled **Checking your session…**.

Selecting **Get started** records that onboarding has started for the current renderer session. A
restored signed-in user should skip Account, check the assistant configuration automatically, and
go directly to Home when configured or see Welcome before the Model stage when incomplete.

### 2. Account

The Account stage should default to sign-in and also support Google sign-in, account creation,
email confirmation, confirmation-email resend, password-reset requests, and password recovery.

An account is optional. Outside password recovery, the footer should provide:

- **Back**, which returns to Welcome;
- **Skip and continue**, which uses Kucedr in local-only mode for the current session.

If Kucedr account services are unavailable, the page should explain that cloud features are
unavailable while leaving Back and local-only continuation available. It must not expose
infrastructure configuration or provider names. Password recovery should take priority over the
normal flow and hide the footer Back and Skip actions until recovery is complete.

After a successful sign-in or local-only continuation, Kucedr should check the stored assistant
configuration. A stored assistant provider and model ID count as complete and lead directly to
Home. An incomplete configuration begins the Model stage.

### 3. Model API keys

The Model stage should list catalog model providers. Each provider card should support opening the
provider's API setup page, connecting, saving, cancelling, and replacing a key. Saved keys should
be masked.

**Continue** should only advance when at least one catalog model provider has a non-empty saved API
key. A value typed into a card but not saved does not satisfy the requirement. If validation or
provider loading fails, the user should remain on this stage and see an inline error.

### 4. Search Engine

The Search stage should let the user save a supported search-provider API key. Search is optional,
so **Continue** should remain available without a configured provider.

### 5. Assistant setup

The final stage should load existing selections and available models, then show these configuration
rows in order:

1. Model
2. Realtime conversation
3. Voice
4. Transcription
5. Image
6. Audio
7. Video
8. Search Engine

Only the primary **Model** selection is required. **Finish** should stay disabled while model data
is loading, while configuration is saving, or until the primary assistant selection is valid.
Voice and Transcription selections may save when changed; Finish should save every valid selected
service. Task and Health check models are configured later from Settings and should not appear as
editable rows here.

Search Engine should only allow selection among search providers connected earlier or in Settings.
Voice, transcription, realtime conversation, search, and generated-media models remain optional.

## Back, completion, and errors

- Back from a setup stage should move to the preceding setup stage.
- Back from Model should return a local-only user to Account so they can sign in. A signed-in user
  should remain on Model because restored authenticated sessions skip Welcome and Account.
- Controls that can repeat a save should be disabled while that save is running.
- Provider-key validation and final save or verification failures should keep the user on the
  current stage and show an accessible inline error.
- Finish should save the selected services and recheck the required assistant provider and model.
  A successful check should navigate to `/home`; a failed check should keep the user on `/start`.

Setup completeness checks for the presence of a stored assistant provider and model ID. It does
not test provider credentials or make a model request. Provider and service configuration should
remain editable later in Settings.

## Session behavior

The onboarding-started flag and local-only choice should use session storage. They should survive a
renderer refresh within the session without becoming durable account preferences. Provider keys,
model selections, and other completed configuration use their existing application stores.

If secure authentication persistence is unavailable and authentication falls back to memory, the
Account stage should tell the user that the signed-in session will not persist after restart.

## Implementation reference

- [Route gate](../../src/renderer/src/auth/Gate.tsx)
- [Onboarding state](../../src/renderer/src/contexts/OnboardingProvider.tsx)
- [Start page](../../src/renderer/src/pages/start/StartPage.tsx)
- [Step definitions](../../src/renderer/src/pages/start/setupConstants.ts)
- [Authentication behavior](../../src/renderer/src/pages/start/components/AuthStep.tsx)
- [Start-flow tests](../../tests/unit/renderer/auth-gate.test.tsx)
- [Model-step tests](../../tests/unit/renderer/setup-models-step.test.tsx)

After configuration succeeds, continue with [Home UI](HOME.md).
