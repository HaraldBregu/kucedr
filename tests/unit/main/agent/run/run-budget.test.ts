import {
	ChatRunBudget,
	RunBudgetStopped,
} from '../../../../../src/main/agent/execution/chat_budget';
import { respondUserInput } from '../../../../../src/main/agent/user_input/user_input_pending';
import { runModelTurn } from '../../../../../src/main/agent/runner/run_model_turn';
import type { ResolvedProvider } from '../../../../../src/shared/provider_types';
import type { RuntimeInput } from '../../../../../src/main/agent/types';

const signal = new AbortController().signal;

it('warns at eighty percent once and checks both limits before each extra call', async () => {
	const budget = new ChatRunBudget({ turns: 5, tokens: 100 }, 'test', 7);
	for (let i = 0; i < 4; i++) budget.record(20);
	expect([...budget.warnings()]).toEqual([
		{ type: 'run_budget_warning', unit: 'turns', used: 4, limit: 5 },
		{ type: 'run_budget_warning', unit: 'tokens', used: 80, limit: 100 },
	]);
	expect([...budget.warnings()]).toEqual([]);
	expect(await budget.beforeCall(8, 16, signal).next()).toEqual({ done: true, value: 12 });
	budget.record(20);
	const call = budget.beforeCall(8, 16, signal);
	const request = (await call.next()).value;
	if (typeof request === 'number' || request.type !== 'user_input_request')
		throw Error('Expected pause');
	expect(request.questions[0].question).toContain('5 of 5 model turns');
	expect(request.questions[0].question).toContain('100 of 100 tokens');
	const scope = { ...request, runId: 'test' };
	const answers = [{ questionId: 'run-budget', answer: 'Continue' }];
	expect(respondUserInput(scope, answers, 8)).toBe(false);
	expect(respondUserInput(scope, answers, 7)).toBe(true);
	expect((await call.next()).value).toMatchObject({
		type: 'user_input_result',
		status: 'resolved',
	});
	expect(await call.next()).toEqual({ done: true, value: 16 });

	const nextCall = budget.beforeCall(8, 16, signal);
	const second = (await nextCall.next()).value;
	if (typeof second === 'number' || second.type !== 'user_input_request')
		throw Error('Expected a new pause');
	expect(
		respondUserInput(
			{ ...second, runId: 'test' },
			[{ questionId: 'run-budget', answer: 'Stop' }],
			7
		)
	).toBe(true);
	await nextCall.next();
	await expect(nextCall.next()).rejects.toBeInstanceOf(RunBudgetStopped);
});

it('stops before invoking the provider when the first prompt exceeds the token budget', async () => {
	const stream = jest.fn();
	const budget = new ChatRunBudget({ tokens: 1 }, 'test', 7);
	const call = runModelTurn(
		{ runId: 'test', task: 'chat', message: 'hello' } as RuntimeInput,
		{ id: 'test', apiKey: '' } as ResolvedProvider,
		'model',
		'instructions',
		[{ role: 'user', content: 'hello' }],
		[],
		signal,
		{},
		{ stream },
		'',
		[],
		true,
		undefined,
		undefined,
		undefined,
		[],
		undefined,
		budget
	);
	await expect(call.next()).resolves.toMatchObject({ value: { type: 'context_usage' } });
	const request = (await call.next()).value;
	if (!('type' in request) || request.type !== 'user_input_request') throw Error('Expected pause');
	expect(stream).not.toHaveBeenCalled();
	respondUserInput(
		{ ...request, runId: 'test' },
		[{ questionId: 'run-budget', answer: 'Stop' }],
		7
	);
	await call.next();
	await expect(call.next()).rejects.toBeInstanceOf(RunBudgetStopped);
	expect(stream).not.toHaveBeenCalled();
});

it('caps the outgoing output allowance and warns using the provider-reported usage', async () => {
	const stream = jest.fn(async function* () {
		yield { type: 'model_call_delta' as const, delta: 'Done.' };
		yield {
			type: 'model_call_end' as const,
			model: 'model',
			usage: { inputTokens: 800, outputTokens: 2 },
		};
	});
	const budget = new ChatRunBudget({ turns: 1, tokens: 1000 }, 'test', 7);
	const events = [];
	for await (const event of runModelTurn(
		{ runId: 'test', task: 'chat', message: 'hello' } as RuntimeInput,
		{ id: 'test', apiKey: '' } as ResolvedProvider,
		'model',
		'instructions',
		[{ role: 'user', content: 'hello' }],
		[],
		signal,
		{},
		{ stream },
		'',
		[],
		true,
		undefined,
		undefined,
		undefined,
		[],
		undefined,
		budget
	))
		events.push(event);
	const context = events.find((event) => event.type === 'context_usage');
	if (context?.type !== 'context_usage') throw Error('Expected estimated input');
	expect(stream).toHaveBeenCalledWith(
		expect.objectContaining({ maxTokens: 1000 - context.context.inputTokens })
	);
	expect(events).toContainEqual({
		type: 'run_budget_warning',
		unit: 'tokens',
		used: 802,
		limit: 1000,
	});
	expect(events).toContainEqual({ type: 'run_budget_warning', unit: 'turns', used: 1, limit: 1 });
});
