import { forgetMemoryTool } from '../../../../../src/main/agent/tools/memory/forget_memory';
import { listMemoriesTool } from '../../../../../src/main/agent/tools/memory/list_memories';

it('uses ordinary policy approval for forgetting memory', () => {
	const memoryTool = forgetMemoryTool({ forget: jest.fn() });
	expect(memoryTool.id).toBe('forget_memory');
	expect(memoryTool.hardApproval).toBeUndefined();
});

it('requires an exact ID and delegates deletion to the memory module', async () => {
	const forget = jest.fn().mockResolvedValue({ removed: true });
	const memoryTool = forgetMemoryTool({ forget });
	expect(() => memoryTool.parseInput({ id: 'target' })).toThrow();
	const input = memoryTool.parseInput({ id: 'memory-0123456789abcdef' });
	await expect(memoryTool.run(input)).resolves.toEqual({ removed: true });
	expect(forget).toHaveBeenCalledWith('memory-0123456789abcdef');
});

it('delegates listing to the memory module', async () => {
	const memories = [{ id: 'memory-0123456789abcdef', fact: 'fact' }];
	const list = jest.fn().mockResolvedValue(memories);
	const memoryTool = listMemoriesTool({ list });
	expect(memoryTool.id).toBe('list_memories');
	await expect(memoryTool.run(memoryTool.parseInput({}))).resolves.toEqual({ memories });
	expect(list).toHaveBeenCalledTimes(1);
});
