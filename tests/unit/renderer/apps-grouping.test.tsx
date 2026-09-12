import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolActivityGroup } from '../../../src/renderer/src/pages/home/components/ToolActivityGroup';
import type { AgentToolPart } from '../../../src/renderer/src/pages/home/context';
import { toolPartLabel } from '../../../src/renderer/src/pages/home/components/tool-label';

it('groups app tools under one collapsible activity', async () => {
	const user = userEvent.setup();
	const tools = [
		{ type: 'list_apps', state: 'output-available', toolCallId: 'list' },
		{ type: 'open_apps', state: 'output-available', toolCallId: 'open' },
		{ type: 'close_apps', state: 'output-available', toolCallId: 'close' },
	] satisfies AgentToolPart[];

	render(<ToolActivityGroup tools={tools} />);

	await user.click(screen.getByRole('button', { name: 'Apps' }));
	expect(screen.getByRole('button', { name: /List apps/ })).toBeInTheDocument();
	expect(screen.getByRole('button', { name: /Open apps/ })).toBeInTheDocument();
	expect(screen.getByRole('button', { name: /Close apps/ })).toBeInTheDocument();
});

it('shows clear delegation activity and batch outcomes', () => {
	expect(
		toolPartLabel({
			type: 'subagents',
			state: 'input-available',
			toolCallId: 'delegating',
			input: { tasks: [{ id: 'one' }, { id: 'two' }] },
		})
	).toBe('Delegating 2 tasks…');
	expect(
		toolPartLabel({
			type: 'subagents',
			state: 'output-available',
			toolCallId: 'complete',
			output: [{ status: 'completed' }, { status: 'failed' }],
		})
	).toBe('1/2 subagents completed');
});

it('keeps each delegated task visible while the batch is running', () => {
	render(
		<ToolActivityGroup
			tools={[
				{
					type: 'subagents',
					state: 'input-available',
					toolCallId: 'delegation',
					input: {
						tasks: [
							{ id: 'research', task: 'Search primary sources' },
							{ id: 'review', task: 'Compare the findings' },
						],
					},
				},
			] satisfies AgentToolPart[]}
		/>
	);

	expect(screen.getByLabelText('Subagent activity')).toBeInTheDocument();
	expect(screen.getByText('Search primary sources')).toBeInTheDocument();
	expect(screen.getByText('Compare the findings')).toBeInTheDocument();
});
