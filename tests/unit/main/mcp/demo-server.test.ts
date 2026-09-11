import path from 'node:path';
import { callTool } from '../../../../src/main/mcp/mcp_client_call_tool';
import { close } from '../../../../src/main/mcp/mcp_client_close';
import { connect } from '../../../../src/main/mcp/mcp_client_connect';
import { listTools } from '../../../../src/main/mcp/mcp_client_list_tools';
import { readLocalMcpServer } from '../../../../src/main/mcp/mcp_local_read';
import type { McpClient } from '../../../../src/main/mcp/mcp_types';

const directory = path.resolve('resources/mcp/demo-server');
const demo = {
	type: 'stdio' as const,
	command: process.execPath,
	args: ['server.mjs'],
	cwd: directory,
};

describe('demo MCP server', () => {
	let client: McpClient;

	beforeAll(async () => {
		client = await connect('kucedr-demo', demo, 5_000);
	});

	afterAll(async () => {
		await close(client);
	});

	it('is a valid uploadable local package', () => {
		expect(readLocalMcpServer(directory)).toMatchObject({
			id: 'kucedr-demo',
			source: 'local',
			data: { type: 'stdio', command: 'node', args: ['server.mjs'], cwd: directory },
		});
	});

	it('publishes the demo tools', async () => {
		const result = await listTools(client, 5_000);
		expect(result.tools.map((tool) => tool.name)).toEqual([
			'echo',
			'add_numbers',
			'create_checklist',
		]);
	});

	it('runs every demo tool', async () => {
		const echo = await callTool(client, 'echo', { message: 'Hello Kucedr' });
		const addition = await callTool(client, 'add_numbers', { a: 2, b: 3 });
		const checklist = await callTool(client, 'create_checklist', {
			title: 'Demo',
			items: ['Upload server', 'Test tools'],
		});

		expect(echo.content).toEqual([{ type: 'text', text: 'Hello Kucedr' }]);
		expect(addition.content).toEqual([{ type: 'text', text: '5' }]);
		expect(checklist.content).toEqual([
			{ type: 'text', text: '## Demo\n\n- [ ] Upload server\n- [ ] Test tools' },
		]);
	});
});
