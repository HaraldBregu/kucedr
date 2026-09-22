import { createToolDiscovery } from '../../../../../src/main/agent/runner/run_discovery';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

function fakeTool(id: string, description: string, properties: Record<string, unknown> = {}) {
	return jsonTool({
		id,
		name: id.replaceAll('_', ' '),
		description,
		schema: { type: 'object', properties },
		execute: () => id,
	});
}

describe('progressive tool discovery', () => {
	it('starts with required controls and ranks parameter metadata deterministically', async () => {
		const required = fakeTool('load_skill', 'Activate a selected skill');
		const write = fakeTool('write', 'Write a file', {
			path: { type: 'string', description: 'Destination filename' },
		});
		const search = fakeTool('search_web', 'Search public websites');
		const discovery = createToolDiscovery({
			eligible: [required, write, search],
			required: [required],
		});

		expect(discovery.active().map((tool) => tool.id)).toEqual(['load_skill', 'discover_tools']);
		await discovery.tool.run({ query: 'destination filename', limit: 5 });
		expect(discovery.active().map((tool) => tool.id)).toEqual([
			'load_skill',
			'discover_tools',
			'write',
		]);
	});

	it('does not connect a deferred MCP server before its metadata matches', async () => {
		const mail = fakeTool('mcp__gmail__send', 'Send an email message');
		const load = jest.fn(async () => [{ tool: mail, serverId: 'gmail', serverName: 'Gmail' }]);
		const discovery = createToolDiscovery({
			eligible: [],
			required: [],
			deferredMcpServers: [{ id: 'gmail', name: 'Gmail' }],
			loadMcpServers: load,
		});

		await discovery.tool.run({ query: 'weather forecast', limit: 5 });
		expect(load).not.toHaveBeenCalled();
		await discovery.tool.run({ query: 'gmail email', limit: 5 });
		expect(load).toHaveBeenCalledWith(['gmail'], undefined);
		expect(discovery.active().map((tool) => tool.id)).toContain(mail.id);
	});

	it('removes active tools when later authorization narrows eligibility', async () => {
		const write = fakeTool('write', 'Write a file');
		const discovery = createToolDiscovery({ eligible: [write], required: [] });
		await discovery.tool.run({ query: 'write file', limit: 5 });
		discovery.replaceEligible([]);
		expect(discovery.active().map((tool) => tool.id)).toEqual(['discover_tools']);
	});
});
