import path from 'node:path';
import Store from 'electron-store';
import {
	CODING_PROVIDER_IDS,
	CODING_THINKING_LEVELS,
	CODING_TOOL_MODES,
	isCodingSettings,
	type CodingProviderId,
	type CodingSettings,
	type CodingThinkingLevel,
	type CodingToolMode,
} from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';

export const DEFAULT_CODING_SETTINGS: CodingSettings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: '',
	thinkingLevel: 'medium',
	toolMode: 'read-only',
};

type StoredCodingSettings = CodingSettings & { workingDirectory?: string };

function normalizeSettings(value: unknown): CodingSettings {
	const stored = value && typeof value === 'object' ? (value as Partial<CodingSettings>) : {};
	const providerId = CODING_PROVIDER_IDS.includes(stored.providerId as CodingProviderId)
		? (stored.providerId as CodingProviderId)
		: DEFAULT_CODING_SETTINGS.providerId;
	const thinkingLevel = CODING_THINKING_LEVELS.includes(stored.thinkingLevel as CodingThinkingLevel)
		? (stored.thinkingLevel as CodingThinkingLevel)
		: DEFAULT_CODING_SETTINGS.thinkingLevel;
	const toolMode = CODING_TOOL_MODES.includes(stored.toolMode as CodingToolMode)
		? (stored.toolMode as CodingToolMode)
		: DEFAULT_CODING_SETTINGS.toolMode;
	return {
		runtime: 'pi',
		providerId,
		modelId: typeof stored.modelId === 'string' ? stored.modelId.trim() : '',
		thinkingLevel,
		toolMode,
	};
}

export class CodingStore {
	private readonly store: Store<StoredCodingSettings>;
	private readonly legacyWorkingDirectory?: string;

	constructor(directory = path.resolve(userDataLocation(), 'settings')) {
		this.store = new Store<StoredCodingSettings>({
			name: 'coder',
			cwd: directory,
			accessPropertiesByDotNotation: false,
			defaults: DEFAULT_CODING_SETTINGS,
		});
		const legacyDirectory = this.store.store.workingDirectory;
		this.legacyWorkingDirectory =
			typeof legacyDirectory === 'string' && path.isAbsolute(legacyDirectory)
				? path.resolve(legacyDirectory)
				: undefined;
		this.store.store = normalizeSettings(this.store.store);
	}

	get(): CodingSettings {
		return normalizeSettings(this.store.store);
	}

	set(settings: CodingSettings): CodingSettings {
		if (!isCodingSettings(settings)) throw new Error('Invalid coding settings.');
		const normalized = normalizeSettings(settings);
		this.store.store = normalized;
		return normalized;
	}

	getLegacyWorkingDirectory(): string | undefined {
		return this.legacyWorkingDirectory;
	}
}
