# Multiple workspaces plan

Status: proposal. Nothing here is implemented. Today the workspace is fixed at
`~/.kucedr/workspace` ([agent_location.ts](../src/main/shared/agent_location.ts)).

## Goal

Users can create several named workspaces and switch between them. Each workspace has a display
name and an optional image, and its folder is named with a generated ID, so renaming never moves
files or breaks paths.

Each workspace separates **files only**. Chats, memory, settings, providers, skills, and Library
stay shared across workspaces.

## Data model

The registry lives in `~/.kucedr/settings/workspaces.json`:

```json
{
	"active": "0f8b6c1e-52a7-4c3e-9d41-7a1c2e6b90d3",
	"workspaces": [
		{ "id": "default", "name": "Personal" },
		{
			"id": "0f8b6c1e-52a7-4c3e-9d41-7a1c2e6b90d3",
			"name": "Client work",
			"image": "6d2e9a40-1b7c-4f35-8e02-c94d7f1a3b68.png"
		}
	]
}
```

| Workspace | Folder                           |
| --------- | -------------------------------- |
| `default` | `~/.kucedr/workspace` (unchanged) |
| Any other | `~/.kucedr/workspaces/<id>/`     |

- **IDs:** generated with `crypto.randomUUID()` and never shown as the primary label.
- **Names:** trimmed, 1–64 characters, and unique ignoring case. Renaming only changes the registry.
- **Images:** optional. `image` is a generated file name in `~/.kucedr/settings/workspace-images/`.
  Images stay outside the workspace folders so they don't appear in the file tree or become
  readable by the agent as workspace files.
- **Missing file:** behaves as a single `default` workspace named "Personal", so existing installs
  need no migration. The existing folder is not moved, because saved permission rules, backups, and
  chat history can contain its absolute path.
- **Invalid data:** the file can be edited by hand, so an ID must be `default` or a UUID before it
  is joined into a path. If `active` is missing from the list or invalid, fall back to `default`.

## Main process changes

### Resolve the active workspace

`agentLocation()` returns the active folder. It stays synchronous and reads the registry once per
process, because it runs at module load through `AGENT_DIRECTORY` in
[agent_store.ts](../src/main/agent/agent_store.ts). Its 33 call sites need no other change.

### Switch by relaunching

Switching saves `active`, then calls `app.relaunch()` and `app.exit()`. The active path is captured
in long-lived state, and a restart resets all of it:

- `AGENT_DIRECTORY` and the default permission patterns in `agent_store.ts`
- `Agent.config.location` in [agent.ts](../src/main/agent/agent.ts)
- the one-shot file watcher in [ipc/agent.ts](../src/main/ipc/agent.ts)
- `workspaceDirectory` in [coding/projects.ts](../src/main/coding/projects.ts)

If an agent run is active, the renderer asks for confirmation first because relaunching stops it.
The app does not use `app.relaunch()` anywhere yet, so check it in both dev and packaged builds.

### Keep sessions in one place

`sessionsRoot()` is currently the workspace folder's sibling
([session_sessions_root.ts](../src/main/agent/session/session_sessions_root.ts)). A workspace in
`~/.kucedr/workspaces/<id>` would therefore write to `~/.kucedr/workspaces/sessions` and lose access
to existing chats. Change it to `path.join(userDataLocation(), 'sessions')`.

`location` then has no effect on that function, so remove the parameter and update its callers.

### Stop trusting the previous workspace

`setPermissions()` saves the merged rules, including the current workspace pattern, into the
profile. After a switch, the old workspace's pattern would stay in the allow list, so the agent
could still read, write, and run commands there without asking.

Both `getPermissions()` and `setPermissions()` must remove default patterns for inactive workspaces:
any `<userData>/workspace/**` or `<userData>/workspaces/<id>/**` rule other than the active one. A
user can still grant access to another workspace through a narrower rule, or a rule on its
subfolder. The Permissions page shows only the active workspace as trusted.

### Include all workspaces in backups

`syncFolders()` in [storage_sync_folders.ts](../src/main/storage/storage_sync_folders.ts) uses
`agentLocation()`, so backup choices would change with every switch. Pin `agent` to
`~/.kucedr/workspace` and add a new `workspaces` key for `~/.kucedr/workspaces`. Check that existing
backup settings and restores still work for the `agent` key.

### IPC

Add these channels with the usual `wrapIpcHandler` and renderer checks:

| Channel  | Behavior                                                     |
| -------- | ------------------------------------------------------------ |
| `list`   | Return the workspaces and the active ID                      |
| `create` | Validate the name, generate the ID, save, and create the folder |
| `rename` | Validate the name and update the registry                    |
| `switch` | Validate that the ID exists, save `active`, and relaunch     |

Save the registry with the existing `atomic_write` helper.

## Interface

Add a switcher to the Workspace sidebar
([Sidebar.tsx](../src/renderer/src/pages/workspace/Sidebar.tsx)), using the `DropdownMenu` it
already imports. It shows the active name, lists the other workspaces, and offers **New workspace**
and **Rename**. Names are entered in the existing dialog and input components. Only names are shown,
not IDs. All new text goes through `react-i18next`.

The Home `ChatWorkspace` panel needs no change because it lists the active workspace's files.

## Known limitations

- **Older chats:** chats are shared, but tools resolve relative paths against the active workspace.
  Reopening a chat from another workspace can show or reach files that no longer resolve.
- **Memory:** memory is shared, so facts learned in one workspace can appear in another. This is not
  suitable for keeping confidential client work apart.
- **Deleting a workspace:** left out of the first version. The folder can be removed by hand, but
  the registry entry would remain.
- **One window, one workspace:** a single app instance has one active workspace at a time.

## Implementation order

1. Registry and `agentLocation()` → verify: with no file, the app still uses `~/.kucedr/workspace`.
2. Anchor `sessionsRoot()` → verify: existing chats appear when a non-default workspace is active.
3. Permission cleanup → verify: after a switch, the agent is prompted for the old workspace's files.
4. IPC and relaunch → verify: switching changes the file tree and the agent's working directory.
5. Backup folders → verify: both workspace locations back up and restore.
6. Switcher interface → verify: create, rename, and switch work, and renaming leaves the folder as is.

## Open questions

- Should each workspace also have its own chats and memory? This plan assumes not. Separating them
  later would change the sessions and memory paths, and existing data would need a home.
- Should workspaces be able to live in a folder the user picks, outside `~/.kucedr`? This plan
  assumes not, since the folder name is a generated ID.
