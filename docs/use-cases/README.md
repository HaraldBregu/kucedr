# Kucedr use-case tests

Use these scenarios to test the desktop app from the user's point of view. Each heading is a separate test with a setup step, a prompt or action, and an observable pass condition. Start with a [configured assistant](../APPLICATION.md#get-started), use a new chat for each scenario unless the steps say otherwise, and inspect the expanded tool activity instead of relying only on the final answer.

Replace values in angle brackets with your own disposable test data. Record the selected model/provider, tool name, result or error, and saved output path when applicable. A model answer without the requested tool call does not pass a tool scenario. Provider credentials, network access, permissions, and usage charges can affect the result. See the [provider reference](../PROVIDERS.md) for executable models; catalog-only models are not pass candidates.

| Area            | Scenarios                                                                         |
| --------------- | --------------------------------------------------------------------------------- |
| Conversation    | [Chat, sessions, attachments, planning, goals, and permissions](chat.md)          |
| Setup           | [First run, model selection, and appearance](setup.md)                            |
| Web             | [Search engine, page extraction, and interactive browser](web.md)                 |
| Generated media | [Images, video, music, and sound effects](media.md)                               |
| Speech          | [Dictation, realtime conversation, and read aloud](voice.md)                      |
| Devices         | [Microphone, camera, and screen capture](devices.md)                              |
| Agent work      | [Files, commands, schedules, and health checks](agent.md)                         |
| Personal data   | [Knowledge, memory, Workspace, Library, and backup](data.md)                      |
| Extensions      | [Skills, generic MCP, apps, remote agents, and Telegram](integrations.md)         |
| Google services | [Gmail, Calendar, Drive, Docs, Sheets, Maps, Contacts, and Gmail SMTP](google.md) |

For a full tool-by-tool Google regression, use the existing [Gmail](../GMAIL.md), [Calendar](../CALENDAR.md), and [Drive](../DRIVE.md) scripts. Those scripts are more exhaustive than the everyday scenarios here.

## Result template

Copy this for each scenario:

```text
Scenario:
Date and app version:
Assistant provider/model:
Other service or model:
Input and disposable test ID:
Tool calls or UI actions observed:
Expected result observed: pass / fail / blocked
Error or difference:
Cleanup completed:
```

Mark **blocked** when a prerequisite is missing, such as an unavailable model or a Google MCP server that cannot authenticate. Keep that separate from an execution failure after the prerequisite succeeds.
