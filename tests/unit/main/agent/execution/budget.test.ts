import { ExecutionBudget } from '../../../../../src/main/agent/execution/budget';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

it('reserves one no-tool synthesis turn after delegated work exhausts output', () => {
	const budget = new ExecutionBudget({ output: 1 });
	const tool = jsonTool({
		id: 'read',
		name: 'Read',
		description: 'read',
		schema: { type: 'object' },
		execute: () => undefined,
	});

	budget.observeOutput(1);
	expect(budget.exhausted).toBe(true);

	budget.allowSynthesis();
	expect(budget.exhausted).toBe(false);
	expect(budget.wouldExceed([{ tool, input: {} }])).toBe(true);
	expect(budget.admit(tool, {})).toBe('Execution budget exhausted; this action was not executed.');
});

it('allows the reserved synthesis turn after token exhaustion', () => {
	const budget = new ExecutionBudget({ tokens: 1 });
	budget.reserveModel(1, 0)({ inputTokens: 1, outputTokens: 0 });
	expect(budget.exhausted).toBe(true);

	budget.allowSynthesis();
	expect(() => budget.reserveModel(100, 100)).not.toThrow();
});
