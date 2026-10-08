import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolsPage from '../../../src/renderer/src/pages/settings/pages/assistant/tools/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

it('loads and changes Voice tools independently of Chat and its search configuration', async () => {
	const user = userEvent.setup();
	const chat = { tools: { search_web: { permission: 'deny' } }, mcp: {} };
	let voice = { tools: { search_web: { permission: 'ask' } }, mcp: {} };
	const getToolProfile = jest.fn(async (profile) => (profile === 'voice' ? voice : chat));
	const setToolProfileTool = jest.fn(async (profile, tool, settings) => {
		if (profile === 'voice') voice = { ...voice, tools: { ...voice.tools, [tool.id]: settings } };
		return voice;
	});
	const getSettings = jest.fn();
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: { getToolProfile, setToolProfileTool },
	});
	Object.defineProperty(window, 'search', { configurable: true, value: { getSettings } });
	render(<ToolsPage profile="voice" />);
	const ask = await screen.findByRole('button', { name: 'Search web: Ask' });
	await waitFor(() => expect(ask).toHaveAttribute('aria-pressed', 'true'));
	expect(getToolProfile).toHaveBeenCalledWith('voice');
	expect(getSettings).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'Search web: Always Allow' }));
	await waitFor(() =>
		expect(setToolProfileTool).toHaveBeenCalledWith(
			'voice',
			{ kind: 'builtin', id: 'search_web' },
			{ permission: 'allow' }
		)
	);
	expect(chat.tools.search_web.permission).toBe('deny');
});
