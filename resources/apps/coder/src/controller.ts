import type { Dispatch, SetStateAction } from 'react';
import type {
	CodingProject,
	CodingProviderId,
	CodingRunMode,
	CodingSessionSummary,
	CodingThinkingLevel,
	CodingToolMode,
} from '@kucedr/sdk';

export type RunState = 'loading' | 'idle' | 'running' | 'error';

export interface CodingMessageBlock {
	id: string;
	type: 'message';
	role: 'user' | 'assistant';
	content: string;
	status: 'streaming' | 'complete' | 'error';
	timestamp: string;
}

export interface CodingToolBlock {
	id: string;
	type: 'tool';
	toolName: string;
	status: 'running' | 'succeeded' | 'failed';
	timestamp: string;
}

export interface CodingCommandBlock {
	id: string;
	type: 'command';
	command: string;
	output: string;
	status: 'running' | 'succeeded' | 'failed' | 'cancelled';
	exitCode?: number;
	truncated: boolean;
	timestamp: string;
}

export type CodingBlock = CodingMessageBlock | CodingToolBlock | CodingCommandBlock;

export interface CodingController {
	activeProject?: CodingProject;
	activeProjectId?: string;
	activeSessionId?: string;
	blocks: CodingBlock[];
	busy: boolean;
	error: string;
	input: string;
	isPreview: boolean;
	leftOpen: boolean;
	loading: boolean;
	mode: CodingRunMode;
	modelId: string;
	projects: CodingProject[];
	providerId: CodingProviderId;
	query: string;
	runLabel: string;
	runState: RunState;
	sessions: CodingSessionSummary[];
	sessionsByProject: Readonly<Record<string, readonly CodingSessionSummary[]>>;
	expandedProjectIds: readonly string[];
	thinkingLevel: CodingThinkingLevel;
	toolMode: CodingToolMode;
	addProject: () => Promise<void>;
	cancelRun: () => void;
	newSession: (projectId?: string) => void;
	openProject: (projectId: string) => Promise<void>;
	refresh: () => Promise<void>;
	removeProject: (projectId: string) => Promise<void>;
	selectProject: (projectId: string) => Promise<void>;
	selectSession: (projectId: string, sessionId: string) => Promise<void>;
	send: () => Promise<void>;
	setInput: Dispatch<SetStateAction<string>>;
	setLeftOpen: Dispatch<SetStateAction<boolean>>;
	setMode: Dispatch<SetStateAction<CodingRunMode>>;
	setQuery: Dispatch<SetStateAction<string>>;
	toggleProject: (projectId: string) => void;
}
