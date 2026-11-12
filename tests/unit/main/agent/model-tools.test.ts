import OpenAI from 'openai';
import { loadModels } from '../../../../src/main/models';
import { getProvider } from '../../../../src/main/settings_store';
import { modelTools } from '../../../../src/main/agent/tools/model/tools';

jest.mock('openai');
jest.mock('../../../../src/main/models', () => ({ loadModels: jest.fn() }));
jest.mock('../../../../src/main/settings_store', () => ({ getProvider: jest.fn() }));

const post = jest.fn();
const provider = { id: 'example', name: 'Example', baseUrl: 'https://example.com/v1' };

beforeEach(() => {
	jest.resetAllMocks();
	jest.mocked(OpenAI).mockImplementation(() => ({ post }) as never);
	jest.mocked(getProvider).mockReturnValue({ ...provider, apiKey: 'secret' } as never);
	jest.mocked(loadModels).mockReturnValue([{
		id: 'special-model', name: 'Special Model', type: 'decision', location: 'remote',
		provider, url: 'https://example.com/v1',
		metadata: {
			operations: {
				decision: {
					endpoint: '/decisions', description: 'Classify shared state.',
					inputSchema: {
						type: 'object', properties: { state: { type: 'string' } },
						required: ['state'], additionalProperties: false,
					},
				},
			},
		},
	}] as never);
});

it('exposes configured model operations and calls the documented endpoint through the OpenAI client', async () => {
	post.mockResolvedValue({ answers: { result: true } });
	const [tool] = modelTools();
	const signal = new AbortController().signal;
	expect(tool.id).toBe('mdl__example__special-model_decision');
	expect(tool.parseInput({ state: 'text' })).toEqual({ state: 'text' });
	expect(() => tool.parseInput({})).toThrow();
	await expect(tool.run({ state: 'text' }, signal)).resolves.toEqual({ answers: { result: true } });
	expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'secret', baseURL: 'https://example.com/v1' });
	expect(post).toHaveBeenCalledWith('/decisions', {
		body: { state: 'text', model: 'special-model' }, signal,
	});
});

it('does not expose operations without a configured API key', () => {
	jest.mocked(getProvider).mockReturnValue(undefined);
	expect(modelTools()).toEqual([]);
});

it('ignores malformed operation schemas without preventing other tools from loading', () => {
	const model = jest.mocked(loadModels)()[0];
	const valid = model.metadata!.operations!.decision;
	jest.mocked(loadModels).mockReturnValue([{
		...model,
		metadata: { ...model.metadata!, operations: {
			bad: { endpoint: '/bad', description: 'Bad', inputSchema: { type: 'invalid' } },
			decision: valid,
		} },
	}] as never);
	expect(modelTools().map((entry) => entry.id)).toEqual(['mdl__example__special-model_decision']);
});
