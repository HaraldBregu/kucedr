import { BrowserWindow, dialog, shell } from 'electron';
import { CodingChannels } from '../../shared/ipc_channels_definitions';
import {
	isCodingProjectInstructionsUpdate,
	isCodingProjectCreate,
	isCodingProjectFilePath,
	isCodingMarkdownFileName,
	isCodingRunRequest,
	isCodingSettings,
} from '../../shared/coding_types';
import { isCoderLayout } from '../../shared/coder_layout';
import type { Coding } from '../coding';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

const CODING_APP_ID = 'coder';

interface CodingIpcDependencies {
	readonly coding: Coding;
	readonly appRegistry: AppRegistry;
	readonly windows: WindowContextManager;
}

export class CoderIpc implements IpcModule<CodingIpcDependencies> {
	readonly name = 'coder';

	register({ coding, appRegistry, windows }: CodingIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, appRegistry);
		const assertCodingCaller = (event: Electron.IpcMainInvokeEvent): void => {
			if (appRegistry.has(event.sender)) {
				if (appRegistry.resolve(event.sender) === CODING_APP_ID) return;
				throw new Error('Coding is only available to the Coding app.');
			}
			trusted.assert(event);
		};
		registerCommandWithEvent(CodingChannels.setApiKey, (event, provider, key, runtime) => {
			assertCodingCaller(event);
			return coding.setApiKey(provider, key, runtime);
		});
		registerQueryWithEvent(CodingChannels.pickDirectory, async (event) => {
			assertCodingCaller(event);
			const window = BrowserWindow.fromWebContents(event.sender);
			const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] };
			const result = window
				? await dialog.showOpenDialog(window, options)
				: await dialog.showOpenDialog(options);
			return result.canceled ? undefined : result.filePaths[0];
		});
		registerCommandWithEvent(CodingChannels.respond, (event, runId, requestId, response) => {
			assertCodingCaller(event);
			return coding.respond(runId, requestId, response, event.sender.id);
		});
		registerCommandWithEvent(
			CodingChannels.saveSessionSettings,
			(event, projectId, sessionId, settings) => {
				assertCodingCaller(event);
				if (!isCodingSettings(settings)) throw new Error('Invalid Coder settings.');
				return coding.saveSessionSettings(projectId, sessionId, settings);
			}
		);
		registerQueryWithEvent(CodingChannels.getSettings, (event, runtime) => {
			assertCodingCaller(event);
			return coding.getSettings(runtime);
		});
		registerCommandWithEvent(CodingChannels.saveSettings, (event, settings) => {
			assertCodingCaller(event);
			if (!isCodingSettings(settings)) throw new Error('Invalid coding settings.');
			return coding.saveSettings(settings);
		});
		registerQueryWithEvent(CodingChannels.getLayout, (event) => {
			assertCodingCaller(event);
			return coding.getLayout();
		});
		registerCommandWithEvent(CodingChannels.saveLayout, (event, layout) => {
			assertCodingCaller(event);
			if (!isCoderLayout(layout)) throw new Error('Invalid Coder layout.');
			return coding.saveLayout(layout);
		});
		registerQueryWithEvent(CodingChannels.listModels, (event, runtime) => {
			assertCodingCaller(event);
			return coding.listModels(runtime);
		});
		registerQueryWithEvent(CodingChannels.listProjects, (event) => {
			assertCodingCaller(event);
			return coding.listProjects();
		});
		registerQueryWithEvent(CodingChannels.addProject, (event, input) => {
			assertCodingCaller(event);
			if (input === undefined) return coding.addProject();
			if (!isCodingProjectCreate(input)) throw new Error('Invalid Coder workspace configuration.');
			return coding.addProject(input);
		});
		registerCommandWithEvent(CodingChannels.openProject, async (event, projectId) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			const project = coding.listProjects().find((item) => item.id === projectId.trim());
			if (!project || !project.available)
				throw new Error('Coding project directory is unavailable.');
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
		registerQueryWithEvent(CodingChannels.readProjectFile, (event, projectId, filePath) => {
			assertCodingCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				!isCodingProjectFilePath(filePath)
			) {
				throw new Error('Invalid coding project file path.');
			}
			return coding.readProjectFile(projectId.trim(), filePath);
		});
		registerQueryWithEvent(CodingChannels.listProjectFiles, (event, projectId) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			return coding.listProjectFiles(projectId.trim());
		});
		registerQueryWithEvent(CodingChannels.listMarkdownFiles, (event, projectId) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim())
				throw new Error('Invalid coding project id.');
			return coding.listMarkdownFiles(projectId.trim());
		});
		registerQueryWithEvent(CodingChannels.readMarkdownFile, (event, projectId, fileName) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim() || !isCodingMarkdownFileName(fileName))
				throw new Error('Invalid coding Markdown file.');
			return coding.readMarkdownFile(projectId.trim(), fileName);
		});
		registerCommandWithEvent(CodingChannels.createMarkdownFile, (event, projectId, fileName) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim() || !isCodingMarkdownFileName(fileName))
				throw new Error('Invalid coding Markdown file.');
			return coding.createMarkdownFile(projectId.trim(), fileName);
		});
		registerCommandWithEvent(CodingChannels.deleteMarkdownFile, (event, projectId, fileName) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim() || !isCodingMarkdownFileName(fileName))
				throw new Error('Invalid coding Markdown file.');
			return coding.deleteMarkdownFile(projectId.trim(), fileName);
		});
		registerCommandWithEvent(
			CodingChannels.saveMarkdownFile,
			(event, projectId, filePath, content, expectedContent) => {
				assertCodingCaller(event);
				if (
					typeof projectId !== 'string' ||
					!projectId.trim() ||
					!isCodingMarkdownFileName(filePath) ||
					typeof content !== 'string' ||
					typeof expectedContent !== 'string'
				)
					throw new Error('Invalid coding Markdown file.');
				return coding.saveMarkdownFile(projectId.trim(), filePath, content, expectedContent);
			}
		);
		registerCommandWithEvent(CodingChannels.createProjectFile, (event, projectId, filePath) => {
			assertCodingCaller(event);
			if (
				typeof projectId !== 'string' ||
				!projectId.trim() ||
				!isCodingProjectFilePath(filePath)
			) {
				throw new Error('Invalid coding project file path.');
			}
			return coding.createProjectFile(projectId.trim(), filePath);
		});
		registerQueryWithEvent(CodingChannels.getProjectInstructions, (event, projectId, runtime) => {
			assertCodingCaller(event);
			if (typeof projectId !== 'string' || !projectId.trim()) {
				throw new Error('Invalid coding project id.');
			}
			return coding.getProjectInstructions(projectId.trim(), runtime);
		});
		registerCommandWithEvent(
			CodingChannels.saveProjectInstructions,
			(event, projectId, update, runtime) => {
				assertCodingCaller(event);
				if (typeof projectId !== 'string' || !projectId.trim()) {
					throw new Error('Invalid coding project id.');
				}
				if (!isCodingProjectInstructionsUpdate(update)) {
					throw new Error('Invalid coding project instructions.');
				}
				return coding.saveProjectInstructions(projectId.trim(), update, runtime);
			}
		);
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
					if (!event.sender.isDestroyed())
						event.sender.send(CodingChannels.response, responseEvent);
				})
				.finally(() => event.sender.removeListener('destroyed', cancel));
		});
		registerCommandWithEvent(CodingChannels.cancel, (event, runId) => {
			assertCodingCaller(event);
			if (typeof runId !== 'string' || !runId.trim()) throw new Error('Invalid coding run id.');
			return coding.cancel(runId.trim(), event.sender.id);
		});
		registerCommandWithEvent(CodingChannels.connectCodex, (event, runtime) => {
			assertCodingCaller(event);
			const callerId = event.sender.id;
			const cancel = (): void => {
				coding.cancelCodexLogin(callerId);
			};
			event.sender.once('destroyed', cancel);
			return coding
				.connectCodex(
					callerId,
					(authEvent) => {
						if (!event.sender.isDestroyed()) event.sender.send(CodingChannels.authEvent, authEvent);
					},
					runtime
				)
				.finally(() => event.sender.removeListener('destroyed', cancel));
		});
		registerCommandWithEvent(CodingChannels.cancelCodexLogin, (event) => {
			assertCodingCaller(event);
			return coding.cancelCodexLogin(event.sender.id);
		});
		registerCommandWithEvent(CodingChannels.disconnectCodex, (event, runtime) => {
			assertCodingCaller(event);
			return coding.disconnectCodex(runtime);
		});
	}
}
