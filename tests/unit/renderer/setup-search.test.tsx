import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupSearch } from '../../../src/renderer/src/pages/start/components/SetupSearch';

const searchApi = {
	getSettings: jest.fn(),
	selectEngine: jest.fn(),
};

beforeEach(() => {
	Object.defineProperty(window, 'search', {
		configurable: true,
		value: searchApi,
	});
});

it('stays empty when a provider is configured but no search engine is selected', async () => {
	const user = userEvent.setup();
	searchApi.getSettings.mockResolvedValue({
		engineId: null,
		configured: { brave: true, tavily: false },
	});
	render(<SetupSearch />);

	const trigger = await screen.findByRole('combobox', { name: 'Search Engine' });
	expect(trigger).not.toHaveTextContent('Brave');
	expect(trigger).toHaveClass('h-8', 'w-40');
	await user.click(trigger);
});

it('shows a configured search engine selection', async () => {
	searchApi.getSettings.mockResolvedValue({
		engineId: 'brave',
		configured: { brave: true, tavily: false },
	});
	render(<SetupSearch />);

	await waitFor(() =>
		expect(screen.getByRole('combobox', { name: 'Search Engine' })).toHaveTextContent('Brave')
	);
});
