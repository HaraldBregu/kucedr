jest.mock('../../../../../src/main/models', () => ({ findModel: jest.fn() }));

import { validateConfiguration } from '../../../../../src/main/memory/configuration';
import { defaultState } from '../../../../../src/main/memory/defaults';
import { findModel } from '../../../../../src/main/models';

it('accepts defaults and rejects removed schedule settings', () => {
	const config = defaultState().config;
	expect(() => validateConfiguration(config)).not.toThrow();
	expect(() =>
		validateConfiguration({ ...config, cronExpression: '0 * * * *' } as typeof config)
	).toThrow();
});

it('requires a registered model and enforces its supported options', () => {
	const config = { ...defaultState().config, providerId: 'provider', modelId: 'model' };
	expect(() => validateConfiguration(config)).toThrow('supported memory model');
	(findModel as jest.Mock).mockReturnValue({
		metadata: {
			inputs: {
				temperature: { type: 'number', minimum: 0, maximum: 2 },
				effort: { type: 'string', enum: ['low', 'high'] },
				enabled: { type: 'boolean' },
			},
		},
	});
	expect(() =>
		validateConfiguration({
			...config,
			modelOptions: { temperature: 0.5, effort: 'high', enabled: true },
		})
	).not.toThrow();
	for (const modelOptions of [
		{ temperature: 3 },
		{ temperature: 'hot' },
		{ effort: 'invalid' },
		{ enabled: 'true' },
		{ unknown: 1 },
	]) {
		expect(() => validateConfiguration({ ...config, modelOptions })).toThrow(
			'Unsupported memory model option'
		);
	}
});
