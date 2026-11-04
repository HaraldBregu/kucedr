import { updateOpenRouterOptions } from '../../../src/renderer/src/lib/openrouter-options';

it('keeps reasoning effort and token budget mutually exclusive', () => {
	const configured = { temperature: 0.5, reasoning: { max_tokens: 2048, enabled: false } };
	expect(updateOpenRouterOptions(configured, ['reasoning', 'effort'], 'max')).toEqual({
		temperature: 0.5, reasoning: { effort: 'max' },
	});
	expect(updateOpenRouterOptions({ reasoning: { effort: 'high' } }, ['reasoning', 'max_tokens'], 1024)).toEqual({
		reasoning: { max_tokens: 1024 },
	});
	expect(updateOpenRouterOptions({ reasoning: { effort: 'high' } }, ['reasoning', 'enabled'], false)).toEqual({
		reasoning: { enabled: false },
	});
});
