const saveMemory = jest.fn();
const forgetMemory = jest.fn();
const listMemories = jest.fn();

jest.mock('../../../../../src/main/agent/memory', () => ({
	MAX_MEMORY_FACT_LENGTH: 500,
	memoryPath: jest.fn(() => '/workspace/MEMORY.md'),
	saveMemory,
	forgetMemory,
	listMemories,
}));

import { forgetMemoryTool } from '../../../../../src/main/agent/tools/memory/forget_memory';
import { listMemoriesTool } from '../../../../../src/main/agent/tools/memory/list_memories';
import { saveMemoryTool } from '../../../../../src/main/agent/tools/memory/save_memory';
import type { Config } from '../../../../../src/main/agent/types';

const config = { location: '/workspace' } as Config;

it.each([
	['save', saveMemoryTool(config)],
	['delete', forgetMemoryTool(config)],
])('allows the main-only memory %s action by default', (_label, memoryTool) => {
	expect(memoryTool.id).toMatch(/^(save|forget)_memory$/);
	expect(memoryTool.hardApproval).toBeUndefined();
});

it('allows durable user context to be saved without an explicit remember request', () => {
	const memoryTool = saveMemoryTool(config);
	expect(memoryTool.description).toContain('Save automatically');
	expect(memoryTool.description).toContain('future plan');
	expect(memoryTool.description).toContain('sensitive personal data');
});

it('requires an exact ID for deletion', () => {
	const memoryTool = forgetMemoryTool(config);
	expect(() => memoryTool.parseInput({ id: 'target' })).toThrow();
	expect(memoryTool.parseInput({ id: 'memory-0123456789abcdef' })).toEqual({
		id: 'memory-0123456789abcdef',
	});
});

it('defines a main-only list_memories read tool', async () => {
	listMemories.mockResolvedValue([{ id: 'memory-0123456789abcdef', fact: 'fact' }]);
	const memoryTool = listMemoriesTool(config);

	expect(memoryTool).toMatchObject({
		id: 'list_memories',
	});
	await expect(memoryTool.run(memoryTool.parseInput({}))).resolves.toEqual({
		memories: [{ id: 'memory-0123456789abcdef', fact: 'fact' }],
	});
});
