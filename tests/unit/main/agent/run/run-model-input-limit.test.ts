const findModel = jest.fn();

jest.mock('../../../../../src/main/models', () => ({ findModel }));

import {
	DEFAULT_MODEL_CONTEXT_TOKENS,
	MODEL_CONTEXT_SAFETY_TOKENS,
	modelInputLimit,
} from '../../../../../src/main/agent/runner/run_model_input_limit';

beforeEach(() => {
	findModel.mockReset();
});

it('uses model catalog input metadata when available', () => {
	findModel.mockReturnValue({
		metadata: { inputs: { max_input_tokens: { type: 'integer', maximum: 100_000 } } },
	});

	expect(modelInputLimit('provider', 'model', 8_000)).toBe(100_000 - MODEL_CONTEXT_SAFETY_TOKENS);
});

it('reserves output and safety tokens from catalog context-window metadata', () => {
	findModel.mockReturnValue({
		metadata: { inputs: { context_window: { type: 'integer', maximum: 128_000 } } },
	});

	expect(modelInputLimit('provider', 'model', 8_000)).toBe(
		128_000 - 8_000 - MODEL_CONTEXT_SAFETY_TOKENS
	);
});

it('uses a provider-documented context window outside the request fields', () => {
	findModel.mockReturnValue({
		metadata: { contextWindow: 1_048_576, inputs: {} },
	});

	expect(modelInputLimit('deepseek', 'deepseek-flash', 32_768)).toBe(1_000_000);
});

it('uses the conservative documented fallback when metadata is unavailable', () => {
	findModel.mockReturnValue(undefined);

	expect(modelInputLimit('provider', 'model', 8_192)).toBe(
		DEFAULT_MODEL_CONTEXT_TOKENS - 8_192 - MODEL_CONTEXT_SAFETY_TOKENS
	);
});
