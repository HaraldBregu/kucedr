import { AgentChannels } from '../../shared/ipc_channels_definitions';
import { watchSessions } from '../agent/session/session_watch';
import { restoreTabs } from '../browser/restore';
import { memoryFor } from '../memory/for';
import { openedWorkspaces } from './opened';
import { workspaceScope } from './scope';
import { sendToWorkspace } from './send';
import type { Workspace } from './types';

export function openWorkspace(workspace: Workspace): void {
	if (openedWorkspaces.has(workspace.id)) return;
	openedWorkspaces.add(workspace.id);
	watchSessions(workspace.sessions, () =>
		sendToWorkspace(workspace.id, AgentChannels.sessionsChanged)
	);
	memoryFor(workspace);
	workspaceScope.run(workspace, restoreTabs);
}
