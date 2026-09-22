const getSearchSettings = jest.fn();
const saveSearchEngine = jest.fn();
const selectSearchEngine = jest.fn();

jest.mock('../../../../src/main/search', () => ({
	getSearchSettings,
	saveSearchEngine,
	selectSearchEngine,
}));

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerQueryWithEvent: jest.fn(),
	registerCommandWithEvent: jest.fn(),
}));

import type { EventBus } from '../../../../src/main/event_bus';
import {
	registerCommandWithEvent,
	registerQueryWithEvent,
} from '../../../../src/main/ipc/core/gateway';
import { SearchIpc } from '../../../../src/main/ipc/search';
import { SearchChannels } from '../../../../src/shared/ipc_channels_definitions';

describe('SearchIpc', () => {
	it('registers the typed search settings handlers', () => {
		new SearchIpc().register(
			{ windows: {} as never, apps: {} as never },
			{} as EventBus
		);

		expect(registerQueryWithEvent).toHaveBeenCalledWith(
			SearchChannels.getSettings,
			expect.any(Function)
		);
		expect(registerCommandWithEvent).toHaveBeenCalledWith(
			SearchChannels.saveEngine,
			expect.any(Function)
		);
		expect(registerCommandWithEvent).toHaveBeenCalledWith(
			SearchChannels.selectEngine,
			expect.any(Function)
		);
	});
});
