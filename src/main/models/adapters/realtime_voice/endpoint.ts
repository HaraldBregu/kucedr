import type { RealtimeVoiceModelSpec } from './realtime_voice_types';

export function realtimeVoiceSocketUrl(
	model: RealtimeVoiceModelSpec,
	options: Record<string, unknown> | undefined,
	providerName: string
): URL {
	const template = model.metadata?.socketUrl;
	if (!template) throw new Error(`${model.name} (${providerName}) declares no socket URL.`);
	return new URL(
		template.replace(/\{(\w+)\}/g, (_match, key: string) => {
			const input = model.metadata?.inputs[key];
			const option = options?.[key] ?? input?.default;
			const value = typeof option === 'string' ? option.trim() : '';
			if (!/^[a-z0-9][a-z0-9-]*$/i.test(value) || (input?.enum && !input.enum.includes(value)))
				throw new Error(
					`${providerName} realtime voice requires a valid ${input?.title ?? key} in model settings.`
				);
			return value;
		})
	);
}
