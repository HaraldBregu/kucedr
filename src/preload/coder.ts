import type { CodingApi } from '../shared/api_types';
import { CodingChannels } from '../shared/ipc_channels_definitions';
import {
	isCoderProjectInstructionsUpdate,
	isCoderRunRequest,
	isCoderSettings,
} from '../shared/coding_types';
import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';

export const coder: CodingApi = {
	getSettings: () => typedInvokeUnwrap(CodingChannels.getSettings),
	saveSettings: (settings) => {
		if (!isCoderSettings(settings)) throw new Error('Invalid coder settings.');
		return typedInvokeUnwrap(CodingChannels.saveSettings, settings);
	},
	listModels: () => typedInvokeUnwrap(CodingChannels.listModels),
	listProjects: () => typedInvokeUnwrap(CodingChannels.listProjects),
	addProject: () => typedInvokeUnwrap(CodingChannels.addProject),
	openProject: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coder project id.');
		return typedInvokeUnwrap(CodingChannels.openProject, normalizedProjectId);
	},
	removeProject: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coder project id.');
		return typedInvokeUnwrap(CodingChannels.removeProject, normalizedProjectId);
	},
	getProjectInstructions: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coder project id.');
		return typedInvokeUnwrap(CodingChannels.getProjectInstructions, normalizedProjectId);
	},
	saveProjectInstructions: (projectId, update) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coder project id.');
		if (!isCoderProjectInstructionsUpdate(update)) {
			throw new Error('Invalid coder project instructions.');
		}
		return typedInvokeUnwrap(CodingChannels.saveProjectInstructions, normalizedProjectId, update);
	},
	listSessions: (projectId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		if (!normalizedProjectId) throw new Error('Invalid coder project id.');
		return typedInvokeUnwrap(CodingChannels.listSessions, normalizedProjectId);
	},
	getSession: (projectId, sessionId) => {
		const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
		const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
		if (!normalizedProjectId || !normalizedSessionId) throw new Error('Invalid coder session.');
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
			throw new Error('Invalid coder session title.');
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
		if (!normalizedProjectId || !normalizedSessionId) throw new Error('Invalid coder session.');
		return typedInvokeUnwrap(CodingChannels.deleteSession, normalizedProjectId, normalizedSessionId);
	},
	send: (request, onEvent) => {
		if (!isCoderRunRequest(request)) throw new Error('Invalid coder run request.');
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
		return typedInvokeUnwrap(CodingChannels.send, normalizedRequest, runId).finally(unsubscribe);
	},
	cancel: (runId) => {
		const normalizedRunId = typeof runId === 'string' ? runId.trim() : '';
		if (!normalizedRunId) throw new Error('Invalid coder run id.');
		return typedInvokeUnwrap(CodingChannels.cancel, normalizedRunId);
	},
	connectCodex: (onEvent) => {
		const unsubscribe = typedOn(CodingChannels.authEvent, (event) => onEvent?.(event));
		return typedInvokeUnwrap(CodingChannels.connectCodex).finally(unsubscribe);
	},
	cancelCodexLogin: () => typedInvokeUnwrap(CodingChannels.cancelCodexLogin),
	disconnectCodex: () => typedInvokeUnwrap(CodingChannels.disconnectCodex),
};
