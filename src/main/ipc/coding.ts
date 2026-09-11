import { BrowserWindow, dialog, shell } from 'electron';
import { CodingChannels } from '../../shared/ipc_channels_definitions';
import {
	isCodingProjectInstructionsUpdate,
	isCodingRunRequest,
	isCodingSettings,
} from '../../shared/coding_types';
import type { Coder } from '../coding';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

interface CodingIpcDependencies {
	readonly coding: Coder;
	readonly appRegistry: AppRegistry;
	readonly windows: WindowContextManager;
}

export class CodingIpc implements IpcModule<CodingIpcDependencies> {
	readonly name = 'coding';

	register({ coding, appRegistry, windows }: CodingIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, appRegistry);
		const assertCodingCaller = (event: Electron.IpcMainInvokeEvent): void => {
			if (appRegistry.has(event.sender)) {
				if (appRegistry.resolve(event.sender) === 'coding') return;
				throw new Error('Coder is only available to the Coder app.');
			}
			trusted.assert(event);
		};
		const assertCodingAppCaller = (event: Electron.IpcMainInvokeEvent): void => {
			if (
				!appRegistry.has(event.sender) ||
				appRegistry.resolve(event.sender) !== 'coding'
			) {
				throw new Error('Project instructions are only available to the Coder app.');
			}
		};
		registerQueryWithEvent(CodingChannels.getSettings, (event) => {
			assertCodingCaller(event);
			return coding.getSettings();
		});
		registerCommandWithEvent(CodingChannels.saveSettings, (event, settings) => {
			assertCodingCaller(event);
			if (!isCodingSettings(settings)) throw new Error('Invalid coding settings.');
			return coding.saveSettings(settings);
		});
		registerQueryWithEvent(CodingChannels.listModels, (event) => {
			assertCodingCaller(event);
			return coding.listModels();
		});
		registerQueryWithEvent(CodingChannels.listProjects, (event) => {
			assertCodingCaller(event);
			return coding.listProjects();
		});
		registerQueryWithEvent(CodingChannels.addProject, async (event) => {
			assertCodingCaller(event);
			const window = BrowserWindow.fromWebContents(event.sender);
			const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] };
			const result = window
				? await dialog.showOpenDialog(window, options)
				: await dialog.showOpenDialog(options);
			return result.canceled || !result.filePaths[0]
				? undefined
				: coding.addProject(result.filePaths[0]);
		});
		registerCommandWithEvent(CodingChannels.openProject, async (event, projectId) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			const project = coding.listProjects().find((item) => item.id === projectId.trim());
			if (!project || !project.available)
				throw new Error('Coder project directory is unavailable.');
			const error = await shell.openPath(project.directory);
			if (error) throw new Error(error);
		});
		registerCommandWithEvent(CodingChannels.removeProject, (event, projectId) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			return coding.removeProject(projectId.trim());
		});
		registerQueryWithEvent(CodingChannels.getProjectInstructions, (event, projectId) => {
			assertCodingAppCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			return coding.getProjectInstructions(projectId.trim());
		});
		registerCommandWithEvent(CodingChannels.saveProjectInstructions, (event, projectId, update) => {
			assertCodingAppCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			if (!isCodingProjectInstructionsUpdate(update)) {
				throw new Error('Invalid coding project instructions.');
			}
			return coding.saveProjectInstructions(projectId.trim(), update);
		});
		registerQueryWithEvent(CodingChannels.listSessions, (event, projectId) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			return coding.listSessions(projectId.trim());
		});
		registerQueryWithEvent(CodingChannels.getSession, (event, projectId, sessionId) => {
			assertCodingCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				typeof sessionId !== 'string' ||
				!sessionId.trim()
			) {
				throw new Error('Invalid coding session.');
			}
			return coding.getSession(projectId.trim(), sessionId.trim());
		});
		registerCommandWithEvent(CodingChannels.renameSession, (event, projectId, sessionId, title) => {
			assertCodingCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				typeof sessionId !== 'string' ||
				!sessionId.trim() ||
				typeof title !== 'string' ||
				!title.trim() ||
				title.trim().length > 120
			) {
				throw new Error('Invalid coding session title.');
			}
			return coding.renameSession(projectId.trim(), sessionId.trim(), title.trim());
		});
		registerCommandWithEvent(CodingChannels.deleteSession, (event, projectId, sessionId) => {
			assertCodingCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				typeof sessionId !== 'string' ||
				!sessionId.trim()
			) {
				throw new Error('Invalid coding session.');
			}
			return coding.deleteSession(projectId.trim(), sessionId.trim());
		});
		registerCommandWithEvent(CodingChannels.send, (event, request, runId) => {
			assertCodingCaller(event);
			if (!isCodingRunRequest(request)) throw new Error('Invalid coding run request.');
			if (typeof runId !== 'string' || !runId.trim()) throw new Error('Invalid coding run id.');
			const callerId = event.sender.id;
			const normalizedRunId = runId.trim();
			const cancel = (): void => {
				coding.cancel(normalizedRunId, callerId);
			};
			event.sender.once('destroyed', cancel);
			return coding
				.send(callerId, normalizedRunId, request, (responseEvent) => {
					event.sender.send(CodingChannels.response, responseEvent);
				})
				.finally(() => event.sender.removeListener('destroyed', cancel));
		});
		registerCommandWithEvent(CodingChannels.cancel, (event, runId) => {
			assertCodingCaller(event);
			if (typeof runId !== 'string' || !runId.trim()) throw new Error('Invalid coding run id.');
			return coding.cancel(runId.trim(), event.sender.id);
		});
		registerCommandWithEvent(CodingChannels.connectCodex, (event) => {
			assertCodingCaller(event);
			const callerId = event.sender.id;
			const cancel = (): void => {
				coding.cancelCodexLogin(callerId);
			};
			event.sender.once('destroyed', cancel);
			return coding
				.connectCodex(callerId, (authEvent) => {
					event.sender.send(CodingChannels.authEvent, authEvent);
				})
				.finally(() => event.sender.removeListener('destroyed', cancel));
		});
		registerCommandWithEvent(CodingChannels.cancelCodexLogin, (event) => {
			assertCodingCaller(event);
			return coding.cancelCodexLogin(event.sender.id);
		});
		registerCommandWithEvent(CodingChannels.disconnectCodex, (event) => {
			assertCodingCaller(event);
			return coding.disconnectCodex();
		});
	}
}
