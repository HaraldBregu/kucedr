const findModel = jest.fn();

jest.mock('../../../../../src/main/models', () => ({ findModel }));

import {
	DEFAULT_MODEL_OUTPUT_TOKENS,
	modelOutputLimit,
} from '../../../../../src/main/agent/runner/run_model_output_limit';

beforeEach(() => {
	findModel.mockReset();
});

it('uses the provider-documented default instead of the maximum output capability', () => {
	findModel.mockReturnValue({
		metadata: {
			defaultOutputTokens: 32_768,
			inputs: { max_tokens: { type: 'integer', maximum: 384_000 } },
		},
	});

	expect(modelOutputLimit('deepseek', 'deepseek-flash', {})).toBe(32_768);
});

it('does not treat a catalog maximum as the default request size', () => {
	findModel.mockReturnValue({
		metadata: { inputs: { max_tokens: { type: 'integer', maximum: 384_000 } } },
	});

	expect(modelOutputLimit('provider', 'model', {})).toBe(DEFAULT_MODEL_OUTPUT_TOKENS);
});

it('uses the configured completion token budget and bounds it by the documented maximum', () => {
	findModel.mockReturnValue({
		metadata: {
			outputTokensField: 'max_completion_tokens',
			inputs: {
				max_tokens: { type: 'integer', maximum: 131_072 },
				max_completion_tokens: { type: 'integer', maximum: 131_072 },
			},
		},
	});

	expect(modelOutputLimit('inception', 'mercury-3', {
		max_completion_tokens: 100_000,
		max_tokens: 1_000,
	})).toBe(100_000);
	expect(modelOutputLimit('inception', 'mercury-3', { max_completion_tokens: 150_000 })).toBe(131_072);
	expect(modelOutputLimit('inception', 'mercury-3', { max_tokens: 24_000 })).toBe(24_000);
});

it('retains the output cap for models without a documented maximum', () => {
	expect(modelOutputLimit('provider', 'model', { max_completion_tokens: 100_000 })).toBe(65_536);
});

it('retains the output cap for models with a maximum but no completion-token field', () => {
	findModel.mockReturnValue({ metadata: { inputs: { max_tokens: { type: 'integer', maximum: 384_000 } } } });
	expect(modelOutputLimit('provider', 'model', { max_tokens: 100_000 })).toBe(65_536);
});
