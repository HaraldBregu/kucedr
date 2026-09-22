import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../../shared/user_data_location';
import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from './health_types';
import {
	getAgentProfileModel,
	initializeAgentProfile,
	setAgentProfileModel,
} from '../agent_profiles';

const HEALTH_STORE_NAME = 'health';
const settingsDirectory = path.resolve(userDataLocation(), 'settings');

const store = new Store<HealthSettings>({
	name: HEALTH_STORE_NAME,
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: DEFAULT_HEALTH_SETTINGS,
});

export const healthStorePath = store.path;

function ensureHealthProfile(): void {
	initializeAgentProfile(
		'health',
		{
			textToText: {
				providerId: store.store.providerId ?? '',
				modelId: store.store.modelId ?? '',
				options: store.store.modelOptions ?? {},
			},
		},
		'health-settings'
	);
}

export function getHealthSettings(): HealthSettings {
	ensureHealthProfile();
	const model = getAgentProfileModel('health', 'textToText');
	return {
		...DEFAULT_HEALTH_SETTINGS,
		...store.store,
		providerId: model.providerId || undefined,
		modelId: model.modelId || undefined,
		modelOptions: model.options,
	};
}

export function updateHealthSettings(patch: Partial<HealthSettings>): HealthSettings {
	ensureHealthProfile();
	const { providerId, modelId, modelOptions, ...schedule } = patch;
	if (providerId !== undefined || modelId !== undefined || modelOptions !== undefined) {
		setAgentProfileModel('health', 'textToText', {
			...getAgentProfileModel('health', 'textToText'),
			...(providerId === undefined ? {} : { providerId }),
			...(modelId === undefined ? {} : { modelId }),
			...(modelOptions === undefined ? {} : { options: modelOptions }),
		});
	}
	store.store = { ...store.store, ...schedule };
	return getHealthSettings();
}

export function resetHealthSettings(): HealthSettings {
	store.store = DEFAULT_HEALTH_SETTINGS;
	setAgentProfileModel('health', 'textToText', {
		providerId: '',
		modelId: '',
		options: {},
	});
	return getHealthSettings();
}
