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
		await discovery.tool.run({ query: 'gmail', limit: 5 });
		expect(load).toHaveBeenCalledWith(['gmail'], undefined);
		expect(discovery.active().map((tool) => tool.id)).toContain(mail.id);
	});

	it('preselects only strong matches and caps automatic activation at five tools', async () => {
		const tools = [
			fakeTool('bash', 'Delete a file with a shell command'),
			fakeTool('read', 'Read a file'),
			fakeTool('edit', 'Edit a file'),
			fakeTool('search_web', 'Search public websites'),
		];
		const greeting = createToolDiscovery({ eligible: tools, required: [] });
		await greeting.preselect('hello there');
		expect(greeting.active().map((tool) => tool.id)).toEqual(['discover_tools']);

		const deletion = createToolDiscovery({ eligible: tools, required: [] });
		await deletion.preselect('delete this file');
		expect(deletion.active().map((tool) => tool.id)).toEqual(['discover_tools', 'bash']);

		const files = createToolDiscovery({ eligible: tools, required: [] });
		const selected = await files.preselect('read and edit this file');
		expect(selected.tools.map((tool) => tool.id)).toEqual(
			expect.arrayContaining(['read', 'edit'])
		);
		expect(selected.tools.map((tool) => tool.id)).not.toContain('search_web');

		const cappedTools = Array.from({ length: 6 }, (_, index) =>
			fakeTool(`file_${index}`, `Read and edit file ${index}`)
		);
		const capped = createToolDiscovery({ eligible: cappedTools, required: [] });
		expect((await capped.preselect('read and edit this file')).tools).toHaveLength(5);
	});

	it('activates eligible inactive IDs without exposing unknown IDs', () => {
		const write = fakeTool('write', 'Write a file');
		const discovery = createToolDiscovery({ eligible: [write], required: [] });
		expect(discovery.activateInactive(['missing', 'write']).map((tool) => tool.id)).toEqual([
			'write',
		]);
		expect(discovery.activateInactive(['missing'])).toEqual([]);
	});

	it('removes active tools when later authorization narrows eligibility', async () => {
		const write = fakeTool('write', 'Write a file');
		const discovery = createToolDiscovery({ eligible: [write], required: [] });
		await discovery.tool.run({ query: 'write file', limit: 5 });
		discovery.replaceEligible([]);
		expect(discovery.active().map((tool) => tool.id)).toEqual(['discover_tools']);
	});
});
