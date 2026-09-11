import { typedInvokeUnwrap } from '../shared/ipc_types';
import { SearchChannels } from '../shared/ipc_channels_definitions';
import type { SearchApi } from './index.d';
import type { SearchEngineId, SearchEngineInput, SearchSettings } from '../shared/search_types';

export const search: SearchApi = {
	getSettings: (): Promise<SearchSettings> => {
		return typedInvokeUnwrap(SearchChannels.getSettings);
	},
	listProviders: () => typedInvokeUnwrap(SearchChannels.listProviders),
	saveEngine: (engineId: SearchEngineId, input: SearchEngineInput): Promise<SearchSettings> => {
		return typedInvokeUnwrap(SearchChannels.saveEngine, engineId, input);
	},
	selectEngine: (engineId: SearchEngineId): Promise<SearchSettings> => {
		return typedInvokeUnwrap(SearchChannels.selectEngine, engineId);
	},
};
