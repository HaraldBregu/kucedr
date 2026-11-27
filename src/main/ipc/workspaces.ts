import { BrowserWindow, dialog } from 'electron';
import { z } from 'zod';
import { WorkspacesChannels } from '../../shared/ipc_channels_definitions';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import type { Agent } from '../agent/agent';
import { paneShown } from '../agent/tools/web/browser/pane';
import type { AppRegistry } from '../apps/app_registry';
import type { EventBus } from '../event_bus';
import type { WindowContextManager } from '../window_context';
import { bindWorkspace } from '../workspaces/bind';
import { boundWorkspaces } from '../workspaces/bound';
import { createWorkspace } from '../workspaces/create';
import { setWorkspaceImage } from '../workspaces/image';
import { listWorkspaces } from '../workspaces/list';
import { locateWorkspace } from '../workspaces/locate';
import { renameWorkspace } from '../workspaces/rename';
import { resolveWorkspace } from '../workspaces/resolve';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface WorkspacesIpcDeps {
	agent: Agent;
	windows: WindowContextManager;
	apps: AppRegistry;
	openWindow?: (workspaceId: string) => void;
}

export class WorkspacesIpc implements IpcModule<WorkspacesIpcDeps> {
	readonly name = 'workspaces';

	register({ agent, windows, apps, openWindow }: WorkspacesIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		const identifier = z.string().max(64);
		const changed = (): void => trusted.broadcast(WorkspacesChannels.changed, undefined);
		const pick = async (
			window: BrowserWindow,
			options: Electron.OpenDialogOptions
		): Promise<string | undefined> => {
			const result = await dialog.showOpenDialog(window, options);
			return result.canceled ? undefined : result.filePaths[0];
		};
		agent.onActivity = changed;
		registerQueryWithEvent(WorkspacesChannels.list, (event) => {
			trusted.assert(event);
			const activity = agent.listActivity();
			const workspaces = listWorkspaces();
			const bound = boundWorkspaces.get(event.sender.id) ?? DEFAULT_WORKSPACE;
			const current = workspaces.some((workspace) => workspace.id === bound)
				? bound
				: DEFAULT_WORKSPACE;
			if (current !== bound) {
				boundWorkspaces.delete(event.sender.id);
				event.sender.send(WorkspacesChannels.changed);
			}
			return {
				current,
				workspaces: workspaces.map((workspace) => ({ ...workspace, ...activity[workspace.id] })),
			};
		});
		registerCommandWithEvent(WorkspacesChannels.select, (event, id) => {
			trusted.assert(event);
			bindWorkspace(event.sender, identifier.parse(id));
			paneShown.get(event.sender)?.view.setVisible(false);
			paneShown.delete(event.sender);
			event.sender.send(WorkspacesChannels.changed);
		});
		registerCommandWithEvent(WorkspacesChannels.create, async (event) => {
			const folder = await pick(trusted.assert(event), {
				properties: ['openDirectory', 'createDirectory'],
			});
			if (!folder) return null;
			const record = createWorkspace(folder);
			changed();
			return { id: record.id, name: record.name, folder: record.folder, missing: false };
		});
		registerCommandWithEvent(WorkspacesChannels.rename, (event, id, name) => {
			trusted.assert(event);
			renameWorkspace(identifier.parse(id), z.string().max(256).parse(name));
			changed();
		});
		registerCommandWithEvent(WorkspacesChannels.locate, async (event, id) => {
			const workspaceId = identifier.parse(id);
			const folder = await pick(trusted.assert(event), { properties: ['openDirectory'] });
			if (!folder) return false;
			locateWorkspace(workspaceId, folder);
			changed();
			return true;
		});
		registerCommandWithEvent(WorkspacesChannels.openWindow, (event, id) => {
			trusted.assert(event);
			if (!openWindow) throw new Error('Windows are unavailable.');
			openWindow(resolveWorkspace(identifier.parse(id)).id);
		});
		registerCommandWithEvent(WorkspacesChannels.pickImage, async (event, id) => {
			const workspaceId = identifier.parse(id);
			const file = await pick(trusted.assert(event), {
				properties: ['openFile'],
				filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
			});
			if (!file) return false;
			setWorkspaceImage(workspaceId, file);
			changed();
			return true;
		});
		registerQueryWithEvent(WorkspacesChannels.chats, (event, id) => {
			trusted.assert(event);
			const workspace = resolveWorkspace(identifier.parse(id));
			return workspaceSessions(workspace.sessions, workspace.id).length;
		});
		registerCommandWithEvent(WorkspacesChannels.reveal, async (event, id) => {
			trusted.assert(event);
			const error = await shell.openPath(resolveWorkspace(identifier.parse(id)).files);
			if (error) throw new Error(error);
		});
		registerCommandWithEvent(WorkspacesChannels.remove, async (event, id) => {
			trusted.assert(event);
			const workspaceId = identifier.parse(id);
			if (workspaceId === DEFAULT_WORKSPACE) throw new Error('The Personal workspace cannot be deleted.');
			const activity = agent.listActivity()[workspaceId];
			if (activity?.running || activity?.waiting)
				throw new Error('Stop the chats running in this workspace first.');
			const workspace = resolveWorkspace(workspaceId);
			await withinWorkspace(workspaceId, () =>
				Promise.all(
					workspaceSessions(workspace.sessions, workspaceId).map((sessionId) =>
						agent.deleteSession(sessionId)
					)
				)
			);
			await removeWorkspace(workspaceId);
			changed();
		});
		registerCommandWithEvent(WorkspacesChannels.removeImage, (event, id) => {
			trusted.assert(event);
			setWorkspaceImage(identifier.parse(id));
			changed();
		});
	}
}
