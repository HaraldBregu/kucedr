import type { ProviderManifest } from '../provider_types';

const MODEL_SERVICE_TYPES = [
	'large-language-model',
	'research-chat-model',
	'speech-to-text-model',
	'text-to-speech-model',
	'realtime-voice-model',
	'text-to-image-model',
	'text-to-video-model',
	'text-to-audio-model',
	'embedding-model',
] as const;

const SERVICE_TYPES = [...MODEL_SERVICE_TYPES, 'web-search', 'database', 'mcp', 'bot'] as const;

const PROMPT_MODEL_SERVICE_TYPES = ['large-language-model', 'research-chat-model'] as const;
const PROMPT_ATTACHMENT_KINDS = ['image', 'document', 'audio', 'video'] as const;
const MIME_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;
const EXTENSION_PATTERN = /^\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function validatePromptAttachments(value: unknown, path: string): string[] {
	if (!Array.isArray(value)) return [`${path} must be an array.`];
	return value.flatMap((item, index) => {
		const itemPath = `${path}[${index}]`;
		if (typeof item !== 'object' || item === null || Array.isArray(item)) {
			return [`${itemPath} must be an object.`];
		}
		const rule = item as Record<string, unknown>;
		const errors: string[] = [];
		if (!PROMPT_ATTACHMENT_KINDS.includes(rule.kind as (typeof PROMPT_ATTACHMENT_KINDS)[number])) {
			errors.push(`${itemPath}.kind must be one of ${PROMPT_ATTACHMENT_KINDS.join(', ')}.`);
		}
		if (!Array.isArray(rule.mimeTypes) || rule.mimeTypes.length === 0) {
			errors.push(`${itemPath}.mimeTypes must be a non-empty array.`);
		} else {
			rule.mimeTypes.forEach((mimeType, mimeIndex) => {
				if (typeof mimeType !== 'string' || !MIME_TYPE_PATTERN.test(mimeType)) {
					errors.push(`${itemPath}.mimeTypes[${mimeIndex}] must be a valid MIME type.`);
				}
			});
		}
		if (!Array.isArray(rule.extensions) || rule.extensions.length === 0) {
			errors.push(`${itemPath}.extensions must be a non-empty array.`);
		} else {
			rule.extensions.forEach((extension, extensionIndex) => {
				if (typeof extension !== 'string' || !EXTENSION_PATTERN.test(extension)) {
					errors.push(
						`${itemPath}.extensions[${extensionIndex}] must be a lowercase dot-prefixed extension.`
					);
				}
			});
		}
		for (const limit of ['maxFiles', 'maxBytes', 'maxTotalBytes'] as const) {
			if (
				rule[limit] !== undefined &&
				(!Number.isInteger(rule[limit]) || (rule[limit] as number) <= 0)
			) {
				errors.push(`${itemPath}.${limit} must be a positive integer when present.`);
			}
		}
		return errors;
	});
}

/** Validate a provider manifest. Returns human-readable errors, empty when valid. */
export function validateProviderManifest(value: unknown): string[] {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return ['manifest.json must be an object.'];
	}
	const manifest = value as Record<string, unknown>;
	const errors: string[] = [];
	if (!isNonEmptyString(manifest.providerId)) {
		errors.push('manifest.json: "providerId" must be a non-empty string.');
	}
	if (!isNonEmptyString(manifest.providerName)) {
		errors.push('manifest.json: "providerName" must be a non-empty string.');
	}
	if (manifest.apiKeyUrl !== undefined && !isNonEmptyString(manifest.apiKeyUrl)) {
		errors.push('manifest.json: "apiKeyUrl" must be a non-empty string when present.');
	}
	if (manifest.images_url !== undefined && manifest.images_url !== '/images') {
		errors.push('manifest.json: "images_url" must be "/images" when present.');
	}
	for (const field of ['icon_dark_url', 'icon_light_url'] as const) {
		if (
			manifest[field] !== undefined &&
			(!isNonEmptyString(manifest[field]) || !manifest[field].startsWith('/images/'))
		) {
			errors.push(`manifest.json: "${field}" must be an /images/ path when present.`);
		}
	}
	if (!Array.isArray(manifest.services))
		return [...errors, 'manifest.json: "services" must be an array.'];
	return manifest.services.flatMap((value, index) => {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			return [`manifest.json: services[${index}] must be an object.`];
		}
		const service = value as Record<string, unknown>;
		const serviceErrors: string[] = [];
		if (!isNonEmptyString(service.id))
			serviceErrors.push(`manifest.json: services[${index}].id must be a non-empty string.`);
		if (!isNonEmptyString(service.name))
			serviceErrors.push(`manifest.json: services[${index}].name must be a non-empty string.`);
		if (service.description !== undefined && !isNonEmptyString(service.description)) {
			serviceErrors.push(
				`manifest.json: services[${index}].description must be a non-empty string when present.`
			);
		}
		for (const field of ['icon_dark_url', 'icon_light_url'] as const) {
			if (
				service[field] !== undefined &&
				(!isNonEmptyString(service[field]) || !service[field].startsWith('/images/'))
			) {
				serviceErrors.push(
					`manifest.json: services[${index}].${field} must be an /images/ path when present.`
				);
			}
		}
		if (!SERVICE_TYPES.includes(service.type as (typeof SERVICE_TYPES)[number])) {
			serviceErrors.push(
				`manifest.json: services[${index}].type must be one of ${SERVICE_TYPES.join(', ')}.`
			);
		}
		if (!isNonEmptyString(service.url))
			serviceErrors.push(`manifest.json: services[${index}].url must be a non-empty string.`);
		const metadata = service.metadata;
		const isPromptModel = PROMPT_MODEL_SERVICE_TYPES.includes(
			service.type as (typeof PROMPT_MODEL_SERVICE_TYPES)[number]
		);
		if (
			isPromptModel &&
			(typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))
		) {
			serviceErrors.push(
				`manifest.json: services[${index}].metadata must be an object for prompt models.`
			);
		} else if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
			const promptAttachments = (metadata as Record<string, unknown>).promptAttachments;
			if (isPromptModel && promptAttachments === undefined) {
				serviceErrors.push(
					`manifest.json: services[${index}].metadata.promptAttachments must be declared for prompt models.`
				);
			} else if (promptAttachments !== undefined) {
				serviceErrors.push(
					...validatePromptAttachments(
						promptAttachments,
						`manifest.json: services[${index}].metadata.promptAttachments`
					)
				);
			}
		}
		return serviceErrors;
	});
}

export function parseProviderManifest(value: unknown): ProviderManifest | undefined {
	return validateProviderManifest(value).length === 0 ? (value as ProviderManifest) : undefined;
}
