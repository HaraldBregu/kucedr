const profile = {
	providerId: '',
	modelId: '',
	options: {} as Record<string, unknown>,
};
const getAgentProfileModel = jest.fn(() => profile);
const setAgentProfileModel = jest.fn((_profileId, _modelKey, value) => {
	profile.providerId = value.providerId;
	profile.modelId = value.modelId;
	profile.options = value.options;
});

jest.mock('../../../../../src/main/agent/agent_profiles', () => ({
	getAgentProfileModel,
	setAgentProfileModel,
}));

import { getRuntime } from '../../../../../src/main/tasks/tasks_get_runtime';
import { setRuntime } from '../../../../../src/main/tasks/tasks_set_runtime';

beforeEach(() => {
	getAgentProfileModel.mockClear();
	setAgentProfileModel.mockClear();
	profile.providerId = '';
	profile.modelId = '';
	profile.options = {};
});

it('reads the runtime only from the tasks profile', () => {
	expect(getRuntime()).toBeUndefined();
	profile.providerId = 'openai';
	profile.modelId = 'gpt-5';
	profile.options = { temperature: 0.2 };
	expect(getRuntime()).toEqual({
		providerId: 'openai',
		modelId: 'gpt-5',
		options: { temperature: 0.2 },
	});
});

it('stores the runtime and its model options in the tasks profile', () => {
	expect(setRuntime(' openai ', ' gpt-5 ', { temperature: 0.2 })).toEqual({
		providerId: 'openai',
		modelId: 'gpt-5',
		options: { temperature: 0.2 },
	});
	expect(setAgentProfileModel).toHaveBeenCalledWith('tasks', 'textToText', {
		providerId: 'openai',
		modelId: 'gpt-5',
		options: { temperature: 0.2 },
	});
});
