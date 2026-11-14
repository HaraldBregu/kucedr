import type { ResponseInput } from 'openai/resources/responses/responses';

export function instructions(
	system: string,
	input: ResponseInput,
	enabled: boolean | undefined
): { instructions?: string; input: ResponseInput } {
	if (!enabled || !system) return { instructions: system || undefined, input };
	return {
		input: [
			{
				role: 'developer',
				content: [
					{ type: 'input_text', text: system, prompt_cache_breakpoint: { mode: 'explicit' } },
				],
			},
			...input,
		],
	};
}
