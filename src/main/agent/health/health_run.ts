import type { Agent } from '../agent';
import { getHealthData } from './health_data';
import { getHealthSettings } from './health_store';
import type { HealthActiveHours, HealthLogger } from './health_types';

const HEALTH_AGENT_ID = 'health';
const HEALTH_SESSION_ID = 'health';
const HEALTH_OK = 'HEALTH_OK';

const HEALTH_PROMPT_HEADER = [
	'[HEALTH CHECK] This is an automated background health check, not a user message.',
	'Follow the HEALTH.md checklist below. Do not invent tasks that are not listed.',
	`If nothing needs attention, reply with exactly ${HEALTH_OK} and nothing else.`,
].join('\n');

export async function runHealthCheck(agent: Agent, logger: HealthLogger): Promise<void> {
	const settings = getHealthSettings();
	if (settings.skipWhenBusy && (agent.isBusy('main') || agent.isBusy(HEALTH_AGENT_ID))) {
		logger.info('Health', 'Health check skipped: agent busy');
		return;
	}
	if (!withinActiveHours(settings.activeHours)) {
		logger.info('Health', 'Health check skipped: outside active hours');
		return;
	}

	const checklist = await getHealthData(agent.config);
	if (!hasChecklistItems(checklist)) {
		logger.info('Health', 'Health check skipped: HEALTH.md has no checklist items');
		return;
	}

	logger.info('Health', 'Health check started');
	const message = `${HEALTH_PROMPT_HEADER}\n\n${checklist.trim()}`;
	const response = await agent.send(message, HEALTH_AGENT_ID, {
		type: 'background',
		streaming: false,
		contextMode: 'minimal',
		...(settings.isolatedSession ? { sessionId: HEALTH_SESSION_ID } : {}),
		...(settings.providerId ? { providerId: settings.providerId } : {}),
		...(settings.modelId ? { modelId: settings.modelId } : {}),
		modelOptions: settings.modelOptions ?? {},
	});
	if (response.trim() === HEALTH_OK) {
		logger.info('Health', 'Health check completed: HEALTH_OK');
		return;
	}
	logger.info('Health', 'Health check needs attention', response);
}

function hasChecklistItems(text: string): boolean {
	return text.split('\n').some((line) => {
		const trimmed = line.trim();
		return Boolean(trimmed) && !trimmed.startsWith('#');
	});
}

function withinActiveHours(hours?: HealthActiveHours): boolean {
	if (isDate(hours?.start) && isDate(hours?.end)) {
		const today = localDate();
		return today >= (hours?.start ?? '') && today <= (hours?.end ?? '');
	}
	const start = parseMinutes(hours?.start);
	const end = parseMinutes(hours?.end);
	if (start === undefined || end === undefined || start === end) return true;
	const now = new Date();
	const minutes = now.getHours() * 60 + now.getMinutes();
	return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function isDate(value?: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value?.trim() ?? '');
}

function localDate(): string {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${month}-${day}`;
}

function parseMinutes(value?: string): number | undefined {
	const match = value?.trim().match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return undefined;
	return Number(match[1]) * 60 + Number(match[2]);
}
