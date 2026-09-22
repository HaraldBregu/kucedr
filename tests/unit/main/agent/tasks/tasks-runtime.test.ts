const readState = jest.fn();
const profile = {
	providerId: '',
	modelId: '',
	options: {} as Record<string, unknown>,
};
const initializeAgentProfile = jest.fn((_profileId, patch) => {
	const model = patch.textToText;
	if (!profile.providerId && model) {
		profile.providerId = model.providerId;
		profile.modelId = model.modelId;
		profile.options = model.options;
	}
});
const getAgentProfileModel = jest.fn(() => profile);
const setAgentProfileModel = jest.fn((_profileId, _modelKey, value) => {
	profile.providerId = value.providerId;
	profile.modelId = value.modelId;
	profile.options = value.options;
});

jest.mock('../../../../../src/main/tasks/tasks_read_state', () => ({ readState }));
jest.mock('../../../../../src/main/agent/agent_profiles', () => ({
	initializeAgentProfile,
	getAgentProfileModel,
	setAgentProfileModel,
}));

import { getRuntime } from '../../../../../src/main/tasks/tasks_get_runtime';
import { setRuntime } from '../../../../../src/main/tasks/tasks_set_runtime';

beforeEach(() => {
	readState.mockReset();
	initializeAgentProfile.mockClear();
	getAgentProfileModel.mockClear();
	setAgentProfileModel.mockClear();
	profile.providerId = '';
	profile.modelId = '';
	profile.options = {};
});

it('reads the runtime from top-level provider and model fields', () => {
	readState.mockReturnValue({ providerId: 'openai', modelId: 'gpt-5', schedules: [] });

	expect(getRuntime()).toEqual({ providerId: 'openai', modelId: 'gpt-5', options: {} });
	expect(initializeAgentProfile).toHaveBeenCalledWith(
		'tasks',
		{ textToText: { providerId: 'openai', modelId: 'gpt-5', options: {} } },
		'tasks-runtime'
	);
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
