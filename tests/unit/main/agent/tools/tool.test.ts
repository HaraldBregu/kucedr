import { z } from 'zod';
import { jsonTool, tool } from '../../../../../src/main/agent/tools/tool';

it('does not cut native tools off at thirty seconds by default', () => {
	const nativeTool = jsonTool({
		id: 'long_operation',
		name: 'Long operation',
		description: 'Long operation',
		schema: { type: 'object' },
		execute: () => undefined,
	});

	expect(nativeTool.timeoutMs).toBe(10 * 60_000);
});

it('validates optional input examples against the runtime schema', () => {
	const configured = tool({
		id: 'lookup',
		name: 'Lookup',
		description: 'Look up an item when an exact identifier is known.',
		inputSchema: z.object({ id: z.string().min(1) }),
		inputExamples: [{ id: 'item-1' }],
		execute: () => undefined,
	});

	expect(configured.inputExamples).toEqual([{ id: 'item-1' }]);
	expect(() =>
		tool({
			id: 'invalid',
			name: 'Invalid',
			description: 'Invalid example',
			inputSchema: z.object({ id: z.string() }),
			inputExamples: [{ id: 1 }],
			execute: () => undefined,
		})
	).toThrow();
});

it('keeps the runtime ID separate from the human-readable name', () => {
	const configured = jsonTool({
		id: 'coordinated',
		name: 'Coordinated operation',
		description: 'read safely',
		schema: { type: 'object' },
		execute: () => undefined,
	});

	expect(configured.id).toBe('coordinated');
	expect(configured.name).toBe('Coordinated operation');
	expect(configured.schema).toEqual({ type: 'object' });
});
