import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from './health_types';
import {
	agentProfileStorePath,
	getAgentProfileDocument,
	getAgentProfileModel,
	setAgentProfileDocument,
	setAgentProfileModel,
} from '../agent_profiles';

export const healthStorePath = agentProfileStorePath('health');

export function getHealthSettings(): HealthSettings {
	const stored = getAgentProfileDocument('health') as Partial<HealthSettings>;
	const model = getAgentProfileModel('health', 'textToText');
	return {
		...DEFAULT_HEALTH_SETTINGS,
		...stored,
		providerId: model.providerId || undefined,
		modelId: model.modelId || undefined,
		modelOptions: model.options,
	};
}

export function updateHealthSettings(patch: Partial<HealthSettings>): HealthSettings {
	const { providerId, modelId, modelOptions, ...schedule } = patch;
	setAgentProfileDocument('health', { ...getAgentProfileDocument('health'), ...schedule });
	if (providerId !== undefined || modelId !== undefined || modelOptions !== undefined) {
		setAgentProfileModel('health', 'textToText', {
			...getAgentProfileModel('health', 'textToText'),
			...(providerId === undefined ? {} : { providerId }),
			...(modelId === undefined ? {} : { modelId }),
			...(modelOptions === undefined ? {} : { options: modelOptions }),
		});
	}
	return getHealthSettings();
}

export function resetHealthSettings(): HealthSettings {
	setAgentProfileDocument('health', {
		...getAgentProfileDocument('health'),
		...DEFAULT_HEALTH_SETTINGS,
	});
	setAgentProfileModel('health', 'textToText', {
		providerId: '',
		modelId: '',
		options: {},
	});
	return getHealthSettings();
}
