import { createToolSearch } from '../../../../../src/main/agent/runner/run_discovery';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

function fakeTool(
	id: string,
	description: string,
	properties: Record<string, unknown> = {},
	policy?: { kind: 'mcp'; serverId: string; toolName: string }
) {
	return jsonTool({
		id,
		name: id.replaceAll('_', ' '),
		description,
		...(policy ? { policy } : {}),
		schema: { type: 'object', properties },
		execute: () => id,
	});
}

describe('tool search', () => {
	it('starts with required tools and searches schema metadata', async () => {
		const read = fakeTool('read', 'Read a file');
		const invoices = fakeTool('mcp__billing__invoices', 'Find customer records', {
			invoiceNumber: { type: 'string', description: 'Customer invoice identifier' },
		}, { kind: 'mcp', serverId: 'billing', toolName: 'invoices' });
		const search = createToolSearch({
			eligible: [read, invoices],
			required: [read],
			mcpTools: [{ tool: invoices, serverId: 'billing', serverName: 'Billing' }],
		});

		expect(search.active().map((tool) => tool.id)).toEqual(['read', 'tool_search']);
		const result = await search.tool.run({ query: 'customer invoice', limit: 5 });
		expect(result).toMatchObject({
			selectedToolIds: ['mcp__billing__invoices'],
			selectedCanonicalIds: ['billing.invoices'],
			selectedServiceIds: ['billing'],
		});
		expect(search.active().map((tool) => tool.id)).toEqual([
			'read',
			'tool_search',
			'mcp__billing__invoices',
		]);
	});

	it('retains selected tools and excludes them from repeated searches', async () => {
		const invoices = fakeTool('invoices', 'Find invoices');
		const search = createToolSearch({ eligible: [invoices], required: [] });
		expect(await search.tool.run({ query: 'invoices' })).toMatchObject({
			selectedToolIds: ['invoices'],
		});
		expect(await search.tool.run({ query: 'invoices' })).toMatchObject({
			selectedToolIds: [],
		});
		expect(search.active().filter((tool) => tool.id === 'invoices')).toHaveLength(1);
	});

	it('never returns irrelevant or filtered tools', async () => {
		const invoices = fakeTool('invoices', 'Find customer invoices');
		const weather = fakeTool('weather', 'Forecast rainfall');
		const search = createToolSearch({
			eligible: [invoices, weather],
			required: [],
			filterEligible: (tools) => tools.filter((tool) => tool.id !== 'invoices'),
		});
		expect(await search.tool.run({ query: 'customer invoices' })).toMatchObject({
			selectedToolIds: [],
		});
		expect(search.active().map((tool) => tool.id)).toEqual(['tool_search']);
	});

	it('enforces per-call and per-run selection limits', async () => {
		const tools = Array.from({ length: 20 }, (_, index) =>
			fakeTool(`invoice_${index}`, 'Find invoices')
		);
		const search = createToolSearch({ eligible: tools, required: [] });
		expect((await search.tool.run({ query: 'invoices' }) as { selectedToolIds: string[] }).selectedToolIds).toHaveLength(5);
		expect((await search.tool.run({ query: 'invoices', limit: 8 }) as { selectedToolIds: string[] }).selectedToolIds).toHaveLength(8);
		const last = await search.tool.run({ query: 'invoices', limit: 8 }) as {
			selectedToolIds: string[];
			limitReached: boolean;
		};
		expect(last.selectedToolIds).toHaveLength(3);
		expect(last.limitReached).toBe(true);
		expect((await search.tool.run({ query: 'invoices' }) as { selectedToolIds: string[] }).selectedToolIds).toEqual([]);
	});

	it('removes active tools when authorization narrows eligibility', async () => {
		const invoices = fakeTool('invoices', 'Find invoices');
		const search = createToolSearch({ eligible: [invoices], required: [] });
		await search.tool.run({ query: 'invoices' });
		search.replaceEligible([]);
		expect(search.active().map((tool) => tool.id)).toEqual(['tool_search']);
	});

	it('refreshes active definitions and MCP metadata after a catalog change', async () => {
		const first = fakeTool('mcp__billing__invoices', 'Find invoices', {}, {
			kind: 'mcp', serverId: 'billing', toolName: 'invoices',
		});
		const changed = fakeTool('mcp__billing__invoices', 'Find current invoices', {}, {
			kind: 'mcp', serverId: 'billing', toolName: 'invoices',
		});
		const search = createToolSearch({ eligible: [first], required: [first] });
		search.replaceEligible([changed]);
		search.replaceMcpEntries([{ tool: changed, serverId: 'billing', serverName: 'Billing' }]);
		expect(search.active()[0]).toBe(changed);
	});

	it('keeps canonical IDs unique when an MCP namespace overlaps a native namespace', async () => {
		const read = fakeTool('read', 'Read file contents');
		const remote = fakeTool('mcp__files__read', 'Read remote file contents', {}, {
			kind: 'mcp', serverId: 'files', toolName: 'read',
		});
		const search = createToolSearch({ eligible: [read, remote], required: [] });
		const result = await search.tool.run({ query: 'read file', limit: 8 }) as {
			selectedCanonicalIds: string[];
		};
		expect(result.selectedCanonicalIds).toHaveLength(2);
		expect(new Set(result.selectedCanonicalIds).size).toBe(2);
	});
});
