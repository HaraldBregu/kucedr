import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CodingPage from '../../../src/renderer/src/pages/settings/pages/coding/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, string>) =>
			key === 'settings.coding.apiKeyMissing' ? `Missing ${values?.provider}` : key,
	}),
}));

const settings = {
	runtime: 'pi' as const,
	providerId: 'openai-codex' as const,
	modelId: 'gpt-coding',
	thinkingLevel: 'medium' as const,
	toolMode: 'read-only' as const,
};

const disconnectedCatalog = {
	providers: [
		{
			id: 'openai-codex' as const,
			name: 'OpenAI Codex',
			authentication: 'oauth' as const,
			configured: false,
			models: [{ id: 'gpt-coding', name: 'GPT Coding', reasoning: true, contextWindow: 1000 }],
		},
	],
};

const openExternalUrl = jest.fn();
const connectCodex = jest.fn();

beforeEach(() => {
	Object.defineProperty(window, 'coding', {
		configurable: true,
		value: {
			getSettings: jest.fn().mockResolvedValue(settings),
			saveSettings: jest.fn(async (next) => next),
			listModels: jest.fn().mockResolvedValue(disconnectedCatalog),
			connectCodex,
			cancelCodexLogin: jest.fn(),
			disconnectCodex: jest.fn(),
		},
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { openExternalUrl },
	});
});

it('shows the Pi runtime and current SDK model catalog', async () => {
	render(
		<MemoryRouter>
			<CodingPage />
		</MemoryRouter>
	);

	expect(await screen.findByText('Pi SDK')).toBeInTheDocument();
	expect(screen.getByText('OpenAI Codex')).toBeInTheDocument();
	expect(screen.getByText('GPT Coding')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'settings.coding.connect' })).toBeInTheDocument();
});

it('starts Codex device authentication and displays the projected code', async () => {
	connectCodex.mockImplementation(async (onEvent) => {
		onEvent({
			type: 'device-code',
			userCode: 'ABCD-EFGH',
			verificationUri: 'https://example.com/device',
		});
		return { configured: true, type: 'oauth' };
	});
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<CodingPage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'settings.coding.connect' }));
	await waitFor(() => expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/device'));
	expect(screen.getByText('ABCD-EFGH')).toBeInTheDocument();
	expect(screen.getByText('settings.coding.deviceCodeHelp')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'settings.coding.copyCode' })).toBeInTheDocument();
	expect(screen.getByText('settings.coding.waitingForAuthorization')).toBeInTheDocument();
});
