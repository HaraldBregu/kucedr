import { runToolCall } from '../../../../../src/main/agent/runner/run_tool_call';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import { getA2aTaskTool } from '../../../../../src/main/agent/tools/a2a/get';
import type { RuntimeEvent } from '../../../../../src/main/agent/types';

it.each([
	'camera_recorder_status', 'microphone_recorder_status', 'screen_recorder_status',
	'camera_recorder_stop', 'microphone_recorder_stop', 'screen_recorder_stop', 'get_a2a_task',
])('uses %s without another approval for an existing operation', async (id) => {
	const run = jest.fn().mockResolvedValue('completed');
	const tool = id === 'get_a2a_task' ? { ...getA2aTaskTool, run }
		: jsonTool({ id, name: id, description: id, schema: {}, execute: run });
	const events: RuntimeEvent[] = [];
	for await (const event of runToolCall(tool, { id: 'status', name: id, args: { agentId: 'agent', taskId: 'task', id: 'recording' } }, undefined, undefined, { runId: 'run' })) events.push(event);
	expect(events.at(-1)).toMatchObject({ type: 'tool_call_end', permissionOutcome: 'allow', output: 'completed', isError: undefined });
	expect(run).toHaveBeenCalledTimes(1);
});
