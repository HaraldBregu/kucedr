import cron from 'node-cron';
import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from './types';
import {
	agentProfileStorePath,
	getAgentProfileDocument,
	getAgentProfileModel,
	setAgentProfileDocument,
	setAgentProfileModel,
} from '../agent/agent_profiles';

const HEALTH_CRON = {
	'0m': '*/30 * * * *',
	'1m': '* * * * *',
	'30m': '*/30 * * * *',
	'1h': '0 * * * *',
};

export const healthStorePath = agentProfileStorePath('health');

export function getHealthSettings(): HealthSettings {
	const stored = getAgentProfileDocument('health') as Partial<HealthSettings>;
	const model = getAgentProfileModel('health', 'textToText');
	return {
		...DEFAULT_HEALTH_SETTINGS,
		...stored,
		enabled: stored.enabled ?? stored.every !== '0m',
		cronExpression: stored.cronExpression ?? HEALTH_CRON[stored.every ?? '30m'],
		providerId: model.providerId || undefined,
		modelId: model.modelId || undefined,
		modelOptions: model.options,
	};
}

export function updateHealthSettings(patch: Partial<HealthSettings>): HealthSettings {
	const { providerId, modelId, modelOptions, ...schedule } = patch;
	if (schedule.every !== undefined) {
		schedule.enabled ??= schedule.every !== '0m';
		schedule.cronExpression ??= HEALTH_CRON[schedule.every];
	}
	if (schedule.enabled !== undefined && typeof schedule.enabled !== 'boolean') {
		throw new Error('Invalid health enabled setting.');
	}
	if (schedule.cronExpression !== undefined) {
		if (
			typeof schedule.cronExpression !== 'string' ||
			!cron.validate(schedule.cronExpression.trim())
		) {
			throw new Error('Health schedule must be a valid cron expression.');
		}
		schedule.cronExpression = schedule.cronExpression.trim().replace(/\s+/g, ' ');
	}
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
