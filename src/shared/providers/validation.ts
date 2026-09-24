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

const AUTHENTICATION_TYPES = ['api-key', 'oauth2', 'none'] as const;
const DATABASE_TYPES = ['vector', 'sql', 'nosql'] as const;
const MODEL_LOCATIONS = ['remote', 'local'] as const;

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
	if (
		manifest.authentication !== undefined &&
		!AUTHENTICATION_TYPES.includes(manifest.authentication as (typeof AUTHENTICATION_TYPES)[number])
	) {
		errors.push(
			`manifest.json: "authentication" must be one of ${AUTHENTICATION_TYPES.join(', ')}.`
		);
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
	if (manifest.services !== undefined)
		errors.push('manifest.json: "services" has been replaced by capability fields.');
	for (const key of ['models', 'mcp_servers', 'databases', 'web_search', 'bots'] as const) {
		const entries = manifest[key];
		if (entries === undefined) continue;
		if (!Array.isArray(entries)) {
			errors.push(`manifest.json: "${key}" must be an array.`);
			continue;
		}
		entries.forEach((value, index) => {
			const itemPath = `manifest.json: ${key}[${index}]`;
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				errors.push(`${itemPath} must be an object.`);
				return;
			}
			const entry = value as Record<string, unknown>;
			if (!isNonEmptyString(entry.id)) errors.push(`${itemPath}.id must be a non-empty string.`);
			if (!isNonEmptyString(entry.name))
				errors.push(`${itemPath}.name must be a non-empty string.`);
			if (!isNonEmptyString(entry.url)) errors.push(`${itemPath}.url must be a non-empty string.`);
			if (
				key !== 'bots' &&
				!AUTHENTICATION_TYPES.includes(
					entry.authentication as (typeof AUTHENTICATION_TYPES)[number]
				)
			) {
				errors.push(
					`${itemPath}.authentication must be one of ${AUTHENTICATION_TYPES.join(', ')}.`
				);
			}
			if (entry.description !== undefined && !isNonEmptyString(entry.description)) {
				errors.push(`${itemPath}.description must be a non-empty string when present.`);
			}
			for (const field of ['icon_dark_url', 'icon_light_url'] as const) {
				if (
					entry[field] !== undefined &&
					(!isNonEmptyString(entry[field]) || !entry[field].startsWith('/images/'))
				) {
					errors.push(`${itemPath}.${field} must be an /images/ path when present.`);
				}
			}
			if (key === 'models') {
				if (!MODEL_SERVICE_TYPES.includes(entry.type as (typeof MODEL_SERVICE_TYPES)[number]))
					errors.push(`${itemPath}.type must be one of ${MODEL_SERVICE_TYPES.join(', ')}.`);
				if (!MODEL_LOCATIONS.includes(entry.location as (typeof MODEL_LOCATIONS)[number]))
					errors.push(`${itemPath}.location must be remote or local.`);
				const metadata = entry.metadata;
				const isPromptModel = PROMPT_MODEL_SERVICE_TYPES.includes(
					entry.type as (typeof PROMPT_MODEL_SERVICE_TYPES)[number]
				);
				if (
					isPromptModel &&
					(typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))
				) {
					errors.push(`${itemPath}.metadata must be an object for prompt models.`);
				} else if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
					const attachments = (metadata as Record<string, unknown>).promptAttachments;
					if (isPromptModel && attachments === undefined)
						errors.push(
							`${itemPath}.metadata.promptAttachments must be declared for prompt models.`
						);
					else if (attachments !== undefined)
						errors.push(
							...validatePromptAttachments(attachments, `${itemPath}.metadata.promptAttachments`)
						);
				}
			}
			if (
				key === 'databases' &&
				!DATABASE_TYPES.includes(entry.type as (typeof DATABASE_TYPES)[number])
			) {
				errors.push(`${itemPath}.type must be one of ${DATABASE_TYPES.join(', ')}.`);
			}
		});
	}
	if (manifest.storage !== undefined) {
		const storage = manifest.storage;
		if (typeof storage !== 'object' || storage === null || Array.isArray(storage)) {
			errors.push('manifest.json: "storage" must be an object.');
		} else {
			const entry = storage as Record<string, unknown>;
			if (!isNonEmptyString(entry.id))
				errors.push('manifest.json: storage.id must be a non-empty string.');
			if (!isNonEmptyString(entry.name))
				errors.push('manifest.json: storage.name must be a non-empty string.');
			if (
				!AUTHENTICATION_TYPES.includes(
					entry.authentication as (typeof AUTHENTICATION_TYPES)[number]
				)
			)
				errors.push(
					`manifest.json: storage.authentication must be one of ${AUTHENTICATION_TYPES.join(', ')}.`
				);
			const metadata = entry.metadata;
			if (
				typeof metadata !== 'object' ||
				metadata === null ||
				Array.isArray(metadata) ||
				(metadata as Record<string, unknown>).protocol !== 's3'
			) {
				errors.push('manifest.json: storage.metadata.protocol must be s3.');
			} else {
				const fields = metadata as Record<string, unknown>;
				for (const field of ['region', 'endpointTemplate'] as const) {
					if (fields[field] !== undefined && !isNonEmptyString(fields[field]))
						errors.push(
							`manifest.json: storage.metadata.${field} must be a non-empty string when present.`
						);
				}
				if (fields.forcePathStyle !== undefined && typeof fields.forcePathStyle !== 'boolean')
					errors.push(
						'manifest.json: storage.metadata.forcePathStyle must be a boolean when present.'
					);
			}
		}
	}
	return errors;
}

export function parseProviderManifest(value: unknown): ProviderManifest | undefined {
	return validateProviderManifest(value).length === 0 ? (value as ProviderManifest) : undefined;
}
