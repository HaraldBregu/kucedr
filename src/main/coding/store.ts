import path from 'node:path';
import Store from 'electron-store';
import {
	isCodingSettings,
	type CodingSettings,
	type CoderHarness,
} from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';

export const DEFAULT_CODING_SETTINGS: CodingSettings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: '',
	thinkingLevel: 'medium',
	toolMode: 'read-only',
};

type StoredSettings = Partial<CodingSettings> & {
	profiles?: Partial<Record<CoderHarness, CodingSettings>>;
};

export class CodingStore {
	private readonly store: Store<StoredSettings>;
	constructor(directory = path.join(userDataLocation(), 'coder')) {
		this.store = new Store<StoredSettings>({
			name: 'settings',
			cwd: directory,
			accessPropertiesByDotNotation: false,
			defaults: DEFAULT_CODING_SETTINGS,
		});
	}
	get(runtime?: CoderHarness): CodingSettings {
		const stored = this.store.store;
		const selected = runtime ?? (isCodingSettings(stored) ? stored.runtime : 'pi');
		const candidate =
			stored.profiles?.[selected] ?? (stored.runtime === selected ? stored : undefined);
		return isCodingSettings(candidate)
			? {
					runtime: selected,
					providerId: candidate.providerId,
					modelId: candidate.modelId,
					thinkingLevel: candidate.thinkingLevel,
					toolMode: candidate.toolMode,
					...(candidate.workingDirectory ? { workingDirectory: candidate.workingDirectory } : {}),
				}
			: {
					...DEFAULT_CODING_SETTINGS,
					runtime: selected,
				};
	}
	set(settings: CodingSettings): CodingSettings {
		if (!isCodingSettings(settings)) throw new Error('Invalid Coder settings.');
		const normalized: CodingSettings = {
			runtime: settings.runtime,
			providerId: settings.providerId,
			modelId: settings.modelId.trim(),
			thinkingLevel: settings.thinkingLevel,
			toolMode: settings.toolMode,
			...(settings.workingDirectory?.trim()
				? { workingDirectory: path.resolve(settings.workingDirectory.trim()) }
				: {}),
		};
		if (settings.workingDirectory?.trim() && !path.isAbsolute(settings.workingDirectory.trim()))
			throw new Error('Working directory must be absolute.');
		const stored = this.store.store;
		this.store.store = {
			...normalized,
			profiles: {
				...stored.profiles,
				...(isCodingSettings(stored) ? { [stored.runtime]: this.get(stored.runtime) } : {}),
				[normalized.runtime]: normalized,
			},
		};
		return normalized;
	}
	getLegacyWorkingDirectory(): string | undefined {
		return this.get().workingDirectory;
	}
}
