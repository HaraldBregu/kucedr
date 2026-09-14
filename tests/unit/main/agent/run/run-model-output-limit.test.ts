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
