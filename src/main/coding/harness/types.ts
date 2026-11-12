import type {
	CodingSettings,
	CodingResponseEvent,
	CodingCatalog,
	CodingAuthEvent,
	CodingAuthStatus,
	CoderInteraction,
	CoderInteractionResponse,
} from '../../../shared/coding_types';
import type { ModelHarness } from '../../../shared/model_types';
import type { AuthenticationType } from '../../../shared/provider_types';

export interface HarnessOptions {
	readonly directory: string;
	readonly name: string;
	readonly provider: {
		readonly id: string;
		readonly name: string;
		readonly authentication?: AuthenticationType;
	};
	readonly harness: ModelHarness;
	readonly getApiKey: () => string | undefined;
}

type StripContext<T> = T extends unknown ? Omit<T, 'runId' | 'projectId' | 'sessionId'> : never;
export type HarnessEvent = StripContext<CodingResponseEvent>;

export interface HarnessContext {
	readonly projectId: string;
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
	deleteSession?(id: string): Promise<void>;
	connect?(signal: AbortSignal, emit: (event: CodingAuthEvent) => void): Promise<CodingAuthStatus>;
	disconnect?(): Promise<void>;
	destroy?(): void;
}
