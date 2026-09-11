import { BrowserWindow, dialog, shell } from 'electron';
import { CodingChannels } from '../../shared/ipc_channels_definitions';
import {
	isCoderProjectInstructionsUpdate,
	isCoderRunRequest,
	isCoderSettings,
} from '../../shared/coding_types';
import type { Coder } from '../coder';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

interface CodingIpcDependencies {
	readonly coder: Coder;
	readonly appRegistry: AppRegistry;
	readonly windows: WindowContextManager;
}

export class CodingIpc implements IpcModule<CodingIpcDependencies> {
	readonly name = 'coder';

	register({ coder, appRegistry, windows }: CodingIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, appRegistry);
		const assertCoderCaller = (event: Electron.IpcMainInvokeEvent): void => {
			if (appRegistry.has(event.sender)) {
				if (appRegistry.resolve(event.sender) === 'coder') return;
				throw new Error('Coder is only available to the Coder app.');
			}
			trusted.assert(event);
		};
		const assertCoderAppCaller = (event: Electron.IpcMainInvokeEvent): void => {
			if (
				!appRegistry.has(event.sender) ||
				appRegistry.resolve(event.sender) !== 'coder'
			) {
				throw new Error('Project instructions are only available to the Coder app.');
			}
		};
		registerQueryWithEvent(CodingChannels.getSettings, (event) => {
			assertCoderCaller(event);
			return coder.getSettings();
		});
		registerCommandWithEvent(CodingChannels.saveSettings, (event, settings) => {
			assertCoderCaller(event);
			if (!isCoderSettings(settings)) throw new Error('Invalid coder settings.');
			return coder.saveSettings(settings);
		});
		registerQueryWithEvent(CodingChannels.listModels, (event) => {
			assertCoderCaller(event);
			return coder.listModels();
		});
		registerQueryWithEvent(CodingChannels.listProjects, (event) => {
			assertCoderCaller(event);
			return coder.listProjects();
		});
		registerQueryWithEvent(CodingChannels.addProject, async (event) => {
			assertCoderCaller(event);
			const window = BrowserWindow.fromWebContents(event.sender);
			const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] };
			const result = window
				? await dialog.showOpenDialog(window, options)
				: await dialog.showOpenDialog(options);
			return result.canceled || !result.filePaths[0]
				? undefined
				: coder.addProject(result.filePaths[0]);
		});
		registerCommandWithEvent(CodingChannels.openProject, async (event, projectId) => {
			assertCoderCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coder project id.');
			}
			const project = coder.listProjects().find((item) => item.id === projectId.trim());
			if (!project || !project.available)
				throw new Error('Coder project directory is unavailable.');
			const error = await shell.openPath(project.directory);
			if (error) throw new Error(error);
		});
		registerCommandWithEvent(CodingChannels.removeProject, (event, projectId) => {
			assertCoderCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coder project id.');
			}
			return coder.removeProject(projectId.trim());
		});
		registerQueryWithEvent(CodingChannels.getProjectInstructions, (event, projectId) => {
			assertCoderAppCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coder project id.');
			}
			return coder.getProjectInstructions(projectId.trim());
		});
		registerCommandWithEvent(CodingChannels.saveProjectInstructions, (event, projectId, update) => {
			assertCoderAppCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coder project id.');
			}
			if (!isCoderProjectInstructionsUpdate(update)) {
				throw new Error('Invalid coder project instructions.');
			}
			return coder.saveProjectInstructions(projectId.trim(), update);
		});
		registerQueryWithEvent(CodingChannels.listSessions, (event, projectId) => {
			assertCoderCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coder project id.');
			}
			return coder.listSessions(projectId.trim());
		});
		registerQueryWithEvent(CodingChannels.getSession, (event, projectId, sessionId) => {
			assertCoderCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				typeof sessionId !== 'string' ||
				!sessionId.trim()
			) {
				throw new Error('Invalid coder session.');
			}
			return coder.getSession(projectId.trim(), sessionId.trim());
		});
		registerCommandWithEvent(CodingChannels.renameSession, (event, projectId, sessionId, title) => {
			assertCoderCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				typeof sessionId !== 'string' ||
				!sessionId.trim() ||
				typeof title !== 'string' ||
				!title.trim() ||
				title.trim().length > 120
			) {
				throw new Error('Invalid coder session title.');
			}
			return coder.renameSession(projectId.trim(), sessionId.trim(), title.trim());
		});
		registerCommandWithEvent(CodingChannels.deleteSession, (event, projectId, sessionId) => {
			assertCoderCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				typeof sessionId !== 'string' ||
				!sessionId.trim()
			) {
				throw new Error('Invalid coder session.');
			}
			return coder.deleteSession(projectId.trim(), sessionId.trim());
		});
		registerCommandWithEvent(CodingChannels.send, (event, request, runId) => {
			assertCoderCaller(event);
			if (!isCoderRunRequest(request)) throw new Error('Invalid coder run request.');
			if (typeof runId !== 'string' || !runId.trim()) throw new Error('Invalid coder run id.');
			const callerId = event.sender.id;
			const normalizedRunId = runId.trim();
			const cancel = (): void => {
				coder.cancel(normalizedRunId, callerId);
			};
			event.sender.once('destroyed', cancel);
			return coding
				.send(callerId, normalizedRunId, request, (responseEvent) => {
					event.sender.send(CodingChannels.response, responseEvent);
				})
				.finally(() => event.sender.removeListener('destroyed', cancel));
		});
		registerCommandWithEvent(CodingChannels.cancel, (event, runId) => {
			assertCoderCaller(event);
			if (typeof runId !== 'string' || !runId.trim()) throw new Error('Invalid coder run id.');
			return coder.cancel(runId.trim(), event.sender.id);
		});
		registerCommandWithEvent(CodingChannels.connectCodex, (event) => {
			assertCoderCaller(event);
			const callerId = event.sender.id;
			const cancel = (): void => {
				coder.cancelCodexLogin(callerId);
			};
			event.sender.once('destroyed', cancel);
			return coding
				.connectCodex(callerId, (authEvent) => {
					event.sender.send(CodingChannels.authEvent, authEvent);
				})
				.finally(() => event.sender.removeListener('destroyed', cancel));
		});
		registerCommandWithEvent(CodingChannels.cancelCodexLogin, (event) => {
			assertCoderCaller(event);
			return coder.cancelCodexLogin(event.sender.id);
		});
		registerCommandWithEvent(CodingChannels.disconnectCodex, (event) => {
			assertCoderCaller(event);
			return coder.disconnectCodex();
		});
	}
}
