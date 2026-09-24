import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import A2aPage from '../../../src/renderer/src/pages/settings/pages/a2a/Page';

const list = jest.fn();
const save = jest.fn();
const deleteAgent = jest.fn();
const test = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'a2a', {
		configurable: true,
		value: { list, save, delete: deleteAgent, test },
	});
	list.mockResolvedValue([]);
	save.mockResolvedValue({
		id: 'saved',
		name: 'Remote',
		url: 'https://agent.example',
		authType: 'api-key',
		apiKeyHeader: 'X-Custom-Key',
		enabled: true,
		skills: [],
		hasCredential: true,
	});
});

it('submits API key authentication through save without exposing or separately testing it', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<A2aPage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Add agent' }));
	await user.type(screen.getByLabelText('Name'), 'Remote');
	await user.type(screen.getByLabelText('Base URL'), 'https://agent.example');
	await user.click(screen.getByRole('combobox', { name: 'Authentication' }));
	await user.click(await screen.findByRole('option', { name: 'API key header' }));
	await user.clear(screen.getByLabelText('API key header'));
	await user.type(screen.getByLabelText('API key header'), 'X-Custom-Key');
	await user.type(screen.getByLabelText('Secret'), 'top-secret');
	await user.click(screen.getByRole('button', { name: 'Validate and save' }));

	await waitFor(() =>
		expect(save).toHaveBeenCalledWith({
			name: 'Remote',
			url: 'https://agent.example',
			authType: 'api-key',
			credential: 'top-secret',
			apiKeyHeader: 'X-Custom-Key',
			enabled: true,
		})
	);
	expect(test).not.toHaveBeenCalled();
	expect(screen.queryByDisplayValue('top-secret')).not.toBeInTheDocument();
});

it('never loads a saved credential into the edit form and resets it on cancel', async () => {
	const user = userEvent.setup();
	list.mockResolvedValue([
		{
			id: 'saved',
			name: 'Remote',
			url: 'https://agent.example',
			authType: 'bearer',
			enabled: true,
			skills: [],
			hasCredential: true,
		},
	]);
	render(
		<MemoryRouter>
			<A2aPage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Edit Remote' }));
	expect(screen.getByLabelText('Secret')).toHaveValue('');
	await user.type(screen.getByLabelText('Secret'), 'replacement');
	await user.click(screen.getByRole('button', { name: 'Cancel' }));
	await user.click(screen.getByRole('button', { name: 'Add agent' }));
	expect(screen.queryByLabelText('Secret')).not.toBeInTheDocument();
	expect(screen.getByLabelText('Name')).toHaveValue('');
});
