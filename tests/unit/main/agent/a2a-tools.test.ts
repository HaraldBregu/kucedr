const mockSend = jest.fn();
const mockGet = jest.fn();
const mockCancel = jest.fn();

jest.mock('../../../../src/main/agent/a2a/send', () => ({ sendA2aMessage: mockSend }));
jest.mock('../../../../src/main/agent/a2a/get', () => ({ getA2aTask: mockGet }));
jest.mock('../../../../src/main/agent/a2a/cancel', () => ({ cancelA2aTask: mockCancel }));

import { cancelA2aTaskTool } from '../../../../src/main/agent/tools/a2a/cancel';
import { delegateA2aTool } from '../../../../src/main/agent/tools/a2a/delegate';
import { getA2aTaskTool } from '../../../../src/main/agent/tools/a2a/get';

it.each([delegateA2aTool, cancelA2aTaskTool])(
	'%s requires approval for remote A2A changes',
	(tool) => {
		expect(tool.hardApproval).toBe(true);
	}
);

it('forwards validated task operations and cancellation signals', async () => {
	const controller = new AbortController();
	mockGet.mockResolvedValue('working');
	mockCancel.mockResolvedValue('canceled');
	await expect(
		getA2aTaskTool.run({ agentId: 'agent', taskId: 'task-1' }, controller.signal)
	).resolves.toBe('working');
	await expect(
		cancelA2aTaskTool.run({ agentId: 'agent', taskId: 'task-1' }, controller.signal)
	).resolves.toBe('canceled');
	expect(mockGet).toHaveBeenCalledWith('agent', 'task-1', controller.signal);
	expect(mockCancel).toHaveBeenCalledWith('agent', 'task-1', controller.signal);
});

it('rejects oversized delegation prompts before loading the protocol client', () => {
	expect(() =>
		delegateA2aTool.parseInput({ agentId: 'agent', prompt: 'x'.repeat(100_001) })
	).toThrow();
	expect(mockSend).not.toHaveBeenCalled();
});
