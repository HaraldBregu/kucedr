import type { CodingApi } from '../shared/api_types';
import { CodingChannels } from '../shared/ipc_channels_definitions';
import {
	isCodingProjectInstructionsUpdate,
	isCodingProjectFilePath,
	isCodingRunRequest,
	isCodingSettings,
} from '../shared/coding_types';
import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';

export const coding: CodingApi = {
	setApiKey: (provider, key) => typedInvokeUnwrap(CodingChannels.setApiKey, provider, key),
	pickDirectory: () => typedInvokeUnwrap(CodingChannels.pickDirectory),
	respond: (runId, requestId, response) =>
		typedInvokeUnwrap(CodingChannels.respond, runId, requestId, response),
	saveSessionSettings: (projectId, sessionId, settings) =>
		typedInvokeUnwrap(CodingChannels.saveSessionSettings, projectId, sessionId, settings),
	getSettings: (runtime) => typedInvokeUnwrap(CodingChannels.getSettings, runtime),
	saveSettings: (settings) => {
		if (!isCodingSettings(settings)) throw new Error('Invalid coding settings.');
		return typedInvokeUnwrap(CodingChannels.saveSettings, settings);
	},
	listModels: (runtime) => typedInvokeUnwrap(CodingChannels.listModels, runtime),
	listProjects: () => typedInvokeUnwrap(CodingChannels.listProjects),
	addProject: () => typedInvokeUnwrap(CodingChannels.addProject),
	openProject: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coding project id.');
		return typedInvokeUnwrap(CodingChannels.openProject, normalizedProjectId);
	},
	removeProject: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coding project id.');
		return typedInvokeUnwrap(CodingChannels.removeProject, normalizedProjectId);
	},
	readProjectFile: (projectId, filePath) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId || !isCodingProjectFilePath(filePath)) {
			throw new Error('Invalid coding project file path.');
		}
		return typedInvokeUnwrap(CodingChannels.readProjectFile, normalizedProjectId, filePath);
	},
	listProjectFiles: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coding project id.');
		return typedInvokeUnwrap(CodingChannels.listProjectFiles, normalizedProjectId);
	},
	createProjectFile: (projectId, filePath) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId || !isCodingProjectFilePath(filePath)) {
			throw new Error('Invalid coding project file path.');
		}
		return typedInvokeUnwrap(
			CodingChannels.createProjectFile,
			normalizedProjectId,
			filePath.trim()
		);
	},
	getProjectInstructions: (projectId, runtime) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coding project id.');
		return typedInvokeUnwrap(CodingChannels.getProjectInstructions, normalizedProjectId, runtime);
	},
	saveProjectInstructions: (projectId, update, runtime) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coding project id.');
		if (!isCodingProjectInstructionsUpdate(update)) {
			throw new Error('Invalid coding project instructions.');
		}
		return typedInvokeUnwrap(
			CodingChannels.saveProjectInstructions,
			normalizedProjectId,
			update,
			runtime
		);
	},
	listSessions: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coding project id.');
		return typedInvokeUnwrap(CodingChannels.listSessions, normalizedProjectId);
	},
	getSession: (projectId, sessionId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
		if (!normalizedProjectId || !normalizedSessionId) throw new Error('Invalid coding session.');
		return typedInvokeUnwrap(CodingChannels.getSession, normalizedProjectId, normalizedSessionId);
	},
	renameSession: (projectId, sessionId, title) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
		const normalizedTitle = typeof title === 'string' ? title.trim() : '';
		if (
			!normalizedProjectId ||
			!normalizedSessionId ||
			!normalizedTitle ||
			normalizedTitle.length > 120
		) {
			throw new Error('Invalid coding session title.');
		}
		return typedInvokeUnwrap(
			CodingChannels.renameSession,
			normalizedProjectId,
			normalizedSessionId,
			normalizedTitle
		);
	},
	deleteSession: (projectId, sessionId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
		if (!normalizedProjectId || !normalizedSessionId) throw new Error('Invalid coding session.');
		return typedInvokeUnwrap(
			CodingChannels.deleteSession,
			normalizedProjectId,
			normalizedSessionId
		);
	},
	send: (request, onEvent) => coding.start(request, onEvent).result,
	start: (request, onEvent) => {
		if (!isCodingRunRequest(request)) throw new Error('Invalid coding run request.');
		const normalizedRequest = {
			...request,
			projectId: request.projectId.trim(),
			...(request.sessionId ? { sessionId: request.sessionId.trim() } : {}),
			input: request.input.trim(),
		};
		const runId = crypto.randomUUID();
		const unsubscribe = typedOn(CodingChannels.response, (event) => {
			if (event.runId === runId) onEvent?.(event);
		});
		return {
			runId,
			result: typedInvokeUnwrap(CodingChannels.send, normalizedRequest, runId).finally(unsubscribe),
		};
	},
	cancel: (runId) => {
		const normalizedRunId = typeof runId === 'string' ? runId.trim() : '';
		if (!normalizedRunId) throw new Error('Invalid coding run id.');
		return typedInvokeUnwrap(CodingChannels.cancel, normalizedRunId);
	},
	connectCodex: (onEvent, runtime) => {
		const unsubscribe = typedOn(CodingChannels.authEvent, (event) => onEvent?.(event));
		return typedInvokeUnwrap(CodingChannels.connectCodex, runtime).finally(unsubscribe);
	},
	cancelCodexLogin: () => typedInvokeUnwrap(CodingChannels.cancelCodexLogin),
	disconnectCodex: (runtime) => typedInvokeUnwrap(CodingChannels.disconnectCodex, runtime),
};

export const coder = coding;
