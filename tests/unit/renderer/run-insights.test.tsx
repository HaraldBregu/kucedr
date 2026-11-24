import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Insights } from '../../../src/renderer/src/pages/home/Insights';
import { historyToChatMessages } from '../../../src/renderer/src/pages/home/context/reducer';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

it('loads only the selected reply and displays recorded zeroes and tool steps', async () => {
	const getRunInsights = jest.fn().mockResolvedValue({
		turns: 2, cachedTokens: 0, steps: [{ kind: 'tool', name: 'read_file', offsetMs: 20 }],
	});
	Object.defineProperty(window, 'agent', { configurable: true, value: { getRunInsights } });
	const user = userEvent.setup();
	render(<Insights sessionId="session" reply="selected" />);
	expect(getRunInsights).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'chat.insights.title' }));
	expect(getRunInsights).toHaveBeenCalledWith('session', 'selected');
	expect(await screen.findByText('read_file')).toBeVisible();
	expect(screen.getByText('+20ms')).toBeVisible();
	expect(screen.getByText('0')).toBeVisible();
	expect(screen.getAllByText('chat.insights.unavailable')).toHaveLength(4);
});

it('opens older replies by timestamp and explains a missing trace', async () => {
	const getRunInsights = jest.fn().mockResolvedValue(null);
	Object.defineProperty(window, 'agent', { configurable: true, value: { getRunInsights } });
	const user = userEvent.setup();
	render(<Insights sessionId="session" reply={12345} />);
	await user.click(screen.getByRole('button', { name: 'chat.insights.title' }));
	expect(await screen.findByText('chat.insights.empty')).toBeVisible();
	expect(getRunInsights).toHaveBeenCalledWith('session', 12345);
});

it('groups saved assistant messages within each recorded run', () => {
	const history = historyToChatMessages([
		{ role: 'assistant', runId: 'first', content: 'Working' },
		{ role: 'assistant', runId: 'first', content: 'Done' },
		{ role: 'assistant', runId: 'next', content: 'Next reply' },
	]);
	expect(history).toMatchObject([
		{ runId: 'first', content: 'Working\n\nDone' },
		{ runId: 'next', content: 'Next reply' },
	]);
});
