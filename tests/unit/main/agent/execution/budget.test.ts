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
