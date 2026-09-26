import type {
	CodingSettings,
	CodingResponseEvent,
	CodingCatalog,
	CodingAuthEvent,
	CodingAuthStatus,
	CoderInteraction,
	CoderInteractionResponse,
} from '../../../shared/coding_types';

type StripContext<T> = T extends unknown ? Omit<T, 'runId' | 'projectId' | 'sessionId'> : never;
export type HarnessEvent = StripContext<CodingResponseEvent>;

export interface HarnessContext {
	readonly cwd: string;
	readonly settings: CodingSettings;
	readonly nativeSessionId?: string;
	readonly signal: AbortSignal;
	readonly emit: (event: HarnessEvent) => void;
	readonly approve: (request: CoderInteraction) => Promise<CoderInteractionResponse>;
	readonly saveSession: (id: string) => Promise<void>;
}

export interface CodingHarness {
	run(input: string, context: HarnessContext): Promise<string>;
	listModels(): Promise<CodingCatalog>;
	connect?(signal: AbortSignal, emit: (event: CodingAuthEvent) => void): Promise<CodingAuthStatus>;
	disconnect?(): Promise<void>;
	destroy?(): void;
}
