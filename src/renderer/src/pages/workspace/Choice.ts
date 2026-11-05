import { modelsFor } from '@/lib/providers';

type Capability = Parameters<typeof modelsFor>[0];

export function modelChoice(capability: Capability, names: readonly string[], providerId: string, modelId: string, options: Readonly<Record<string, Readonly<Record<string, string>>>>) {
	const metadata = modelsFor(capability).find((model) => model.provider.id === providerId && model.id === modelId)?.metadata;
	const inputs = metadata?.documentationStatus === 'verified' ? metadata.inputs : {};
	const name = names.find((candidate) => inputs[candidate]);
	const input = name ? inputs[name] : undefined;
	const choices = input?.oneOf?.map((choice) => ({ value: String(choice.const), label: choice.title ?? String(choice.const) })) ?? input?.enum?.map((choice) => ({ value: String(choice), label: String(choice) })) ?? [];
	if (!name || choices.length === 0) return null;
	const key = `${providerId}:${modelId}`;
	const stored = options[key]?.[name];
	const value = choices.some((choice) => choice.value === stored) ? stored : String(input?.default ?? choices[0].value);
	return { key, name, value, choices };
}
