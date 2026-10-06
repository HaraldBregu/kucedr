# Kucedr Demo MCP Server

A dependency-free local MCP server for testing Kucedr's dynamic server workflow.

## Install and test

1. Copy this `demo-server` folder to `~/.kucedr/mcp/servers/kucedr-demo`.
2. Open **Settings → MCP** and select **Kucedr Demo Tools**. The registry rescans local packages when the page loads.
3. Click **Test**. Kucedr should report three tools.

The Settings page currently has no local-package upload or manual refresh action. In a source
checkout, the server is also discovered directly from `resources/mcp`. It uses only Node.js
built-ins, so no package installation is needed.

## Tools

- `echo` returns a supplied string.
- `add_numbers` adds two finite numbers.
- `create_checklist` formats a title and string array as a Markdown checklist.

All tools are read-only demonstrations. The manifest sets `require_approval` to `always`.
