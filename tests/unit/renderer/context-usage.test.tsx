import { render, screen, fireEvent } from '@testing-library/react';
import { Usage } from '../../../src/renderer/src/pages/home/Usage';
import { contextTokens } from '../../../src/renderer/src/pages/home/tokens';
import {
	agentChatReducer,
	historyToChatMessages,
} from '../../../src/renderer/src/pages/home/context/reducer';
import type { AgentMessage } from '../../../src/renderer/src/pages/home/context/state';

const message: AgentMessage = {
	id: 'a',
	role: 'agent',
	type: 'agent',
	content: 'answer',
	state: 'completed',
	tools: [],
	inputTokens: 900000,
	outputTokens: 900000,
	contextUsage: {
		providerId: 'openai',
		modelId: 'small',
		inputTokens: 400,
		outputTokens: 100,
		estimated: false,
		contextWindow: 1000,
	},
};

it('uses the last request instead of cumulative billing totals and updates for the draft', () => {
	expect(contextTokens([message], 'openai', 'small', '')).toMatchObject({
		tokens: 500,
		estimated: false,
	});
	expect(contextTokens([message], 'openai', 'small', 'abcdef')).toMatchObject({
		tokens: 502,
		estimated: true,
	});
});

it('resets the context baseline for the latest request after history is fitted', () => {
	const latest = {
		...message,
		id: 'b',
		contextUsage: { ...message.contextUsage!, inputTokens: 100, outputTokens: 10 },
	};
	expect(contextTokens([message, latest], 'openai', 'small', '').tokens).toBe(110);
	expect(contextTokens([message], 'openai', 'other', '').measured).toBe(false);
});

it('matches the custom local provider to its Ollama selection', () => {
	const local = { ...message, contextUsage: { ...message.contextUsage!, providerId: 'custom' } };
	expect(contextTokens([local], 'ollama', 'small', '').tokens).toBe(500);
});

it('restores the latest per-request snapshot when assistant tool turns merge', () => {
	const restored = historyToChatMessages([
		{
			role: 'assistant',
			content: 'first',
			usage: { inputTokens: 400, outputTokens: 100, context: message.contextUsage },
		},
		{
			role: 'assistant',
			content: 'last',
			usage: {
				inputTokens: 100,
				outputTokens: 10,
				context: { ...message.contextUsage!, inputTokens: 100, outputTokens: 10 },
			},
		},
	]);
	expect(contextTokens(restored, 'openai', 'small', '').tokens).toBe(110);
});

it('stores estimated context even if provider output usage is unavailable', () => {
	const next = agentChatReducer(
		{ messages: [{ ...message, runId: 'r' }], activeAgentId: 'a', activeRunId: 'r' },
		{
			type: 'apply_response_event',
			receivedAtMs: 1,
			event: {
				type: 'model_usage',
				agentId: 'main',
				runId: 'r',
				usage: { context: { ...message.contextUsage!, inputTokens: 800, estimated: true } },
			},
		}
	);
	expect(contextTokens(next.messages, 'openai', 'small', '').tokens).toBe(900);
});

it('shows accessible progress and gives the current limit priority over historical local settings', () => {
	const { rerender } = render(
		<Usage
			providerId="openai"
			modelId="small"
			messages={[message]}
			draft=""
			hasAttachments={false}
			contextWindow={2000}
		/>
	);
	expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
	fireEvent.focus(screen.getByRole('button'));
	expect(screen.getByRole('button')).toHaveAccessibleName('Context: 500 / 2,000 tokens (25% used)');
	rerender(
		<Usage
			providerId="openai"
			modelId="other"
			messages={[message]}
			draft=""
			hasAttachments={false}
		/>
	);
	expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
	expect(screen.getByRole('button')).toHaveAccessibleName('Context window unavailable');
});

it('caps the visual ring at 100 percent while retaining the full token count', () => {
	render(
		<Usage
			providerId="openai"
			modelId="small"
			messages={[message]}
			draft=""
			hasAttachments={false}
			contextWindow={400}
		/>
	);
	expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
	expect(screen.getByRole('button')).toHaveAccessibleName('Context: 500 / 400 tokens (100% used)');
});

it('preserves streamed output estimates when a legacy event has no context or provider usage', () => {
	const current = { ...message, runId: 'r', streamedChars: 90 };
	const next = agentChatReducer(
		{ messages: [current], activeAgentId: 'a', activeRunId: 'r' },
		{
			type: 'apply_response_event',
			receivedAtMs: 1,
			event: { type: 'model_usage', agentId: 'voice', runId: 'r' },
		}
	);
	expect(contextTokens(next.messages, 'openai', 'small', '').tokens).toBe(530);
});
