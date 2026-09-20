import { createToolDiscovery } from '../../../../../src/main/agent/runner/run_discovery';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

function fakeTool(id: string) {
	return jsonTool({
		id,
		name: id.replaceAll('_', ' '),
		description: `${id} capability`,
		schema: { type: 'object' },
		execute: () => id,
	});
}

describe('progressive tool discovery', () => {
	it('starts minimal and enforces per-call, per-run, deduplication, and eligibility boundaries', async () => {
		const eligible = Array.from({ length: 20 }, (_, index) => fakeTool(`tool_${index}`));
		const required = fakeTool('get_goal');
		const discovery = createToolDiscovery({
			eligible: [...eligible, required],
			required: [required],
		});

		expect(discovery.active().map((tool) => tool.id)).toEqual(['get_goal', 'discover_tools']);
		expect(discovery.prompt()).toContain('tool_0 | tool 0 | Not loaded; use discover_tools | tool_0 capability');
		expect(discovery.prompt()).toContain('get_goal | get goal | Loaded');
		expect(discovery.prompt()).not.toContain('"properties"');

		const first = await discovery.tool.run({
			query: 'exact selection',
			toolIds: eligible.slice(0, 10).map((tool) => tool.id),
			mcpServerIds: [],
		});
		expect(first).toMatchObject({
			selectedToolIds: eligible.slice(0, 8).map((tool) => tool.id),
			limitReached: true,
		});
		expect(discovery.prompt()).toContain('tool_0 | tool 0 | Loaded');
		expect(discovery.prompt()).toContain('tool_8 | tool 8 | Not loaded');

		const second = await discovery.tool.run({
			query: 'more exact tools',
			toolIds: eligible.slice(8, 18).map((tool) => tool.id),
			mcpServerIds: [],
		});
		expect((second as { selectedToolIds: string[] }).selectedToolIds).toEqual(
			eligible.slice(8, 16).map((tool) => tool.id)
		);
		expect(discovery.active()).toHaveLength(18);

		const duplicate = await discovery.tool.run({
			query: 'duplicate and ineligible',
			toolIds: ['tool_0', 'denied'],
			mcpServerIds: [],
		});
		expect(duplicate).toMatchObject({ selectedToolIds: [], rejectedToolIds: ['denied'] });
	});

	it('loads only named deferred MCP servers and returns a compact catalog when nothing matches', async () => {
		const gmail = fakeTool('mcp__gmail__send_message');
		const load = jest.fn(async (serverIds: string[]) =>
			serverIds.map(() => ({ tool: gmail, serverId: 'gmail', serverName: 'Gmail' }))
		);
		const discovery = createToolDiscovery({
			eligible: [],
			required: [],
			deferredMcpServers: [
				{ id: 'gmail', name: 'Gmail' },
				{ id: 'calendar', name: 'Calendar' },
			],
			loadMcpServers: load,
		});

		const result = await discovery.tool.run({
			query: 'weather forecast',
			toolIds: [],
			mcpServerIds: ['gmail'],
		});

		expect(load).toHaveBeenCalledWith(['gmail'], undefined);
		expect(result).toMatchObject({
			selectedToolIds: [],
			availableTools: [{ id: gmail.id, name: gmail.name, description: gmail.description }],
		});
		expect(discovery.prompt()).toContain('calendar | Calendar');
		expect(discovery.prompt()).not.toContain('gmail | Gmail');
		expect(discovery.prompt()).toContain('mcp__gmail__send_message | mcp  gmail  send message | Not loaded');
	});
});
