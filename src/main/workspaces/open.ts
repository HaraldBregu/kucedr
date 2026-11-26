import { AgentChannels } from '../../shared/ipc_channels_definitions';
import { watchSessions } from '../agent/session/session_watch';
import { memoryFor } from '../memory/for';
import { sendToWorkspace } from './send';
import type { Workspace } from './types';

const opened = new Set<string>();

export function openWorkspace(workspace: Workspace): void {
	if (opened.has(workspace.id)) return;
	opened.add(workspace.id);
	watchSessions(workspace.sessions, () =>
		sendToWorkspace(workspace.id, AgentChannels.sessionsChanged)
	);
	memoryFor(workspace);
}
