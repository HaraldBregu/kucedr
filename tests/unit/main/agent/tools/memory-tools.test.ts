import { forgetMemoryTool } from '../../../../../src/main/agent/tools/memory/forget_memory';
import { listMemoriesTool } from '../../../../../src/main/agent/tools/memory/list_memories';

it('uses ordinary policy approval for forgetting memory', () => {
	const memoryTool = forgetMemoryTool({ forget: jest.fn() });
	expect(memoryTool.id).toBe('forget_memory');
	expect(memoryTool.hardApproval).toBeUndefined();
});

it('delegates a memory match to the memory module', async () => {
	const forget = jest.fn().mockResolvedValue({ removed: 2 });
	const memoryTool = forgetMemoryTool({ forget });
	const input = memoryTool.parseInput({ match: 'schedule' });
	await expect(memoryTool.run(input)).resolves.toEqual({ removed: 2 });
	expect(forget).toHaveBeenCalledWith('schedule');
});

it('delegates listing to the memory module', async () => {
	const memories = [{ id: 'memory-0123456789abcdef', fact: 'fact' }];
	const list = jest.fn().mockResolvedValue(memories);
	const memoryTool = listMemoriesTool({ list });
	expect(memoryTool.id).toBe('list_memories');
	await expect(memoryTool.run(memoryTool.parseInput({}))).resolves.toEqual({ memories });
	expect(list).toHaveBeenCalledTimes(1);
});
