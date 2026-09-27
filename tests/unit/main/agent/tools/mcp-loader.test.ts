const connectMock = jest.fn();
const listToolsMock = jest.fn();
const closeMock = jest.fn();
const getMcpServersMock = jest.fn();
const getMcpToolCatalogMock = jest.fn();
const callToolMock = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	connect: (...args: unknown[]) => connectMock(...args),
	listTools: (...args: unknown[]) => listToolsMock(...args),
	close: (...args: unknown[]) => closeMock(...args),
	callTool: (...args: unknown[]) => callToolMock(...args),
	getMcpServers: () => getMcpServersMock(),
	getMcpToolCatalog: (id: string) => getMcpToolCatalogMock(id),
}));

import { loadMcpTools } from '../../../../../src/main/agent/tools/mcp/loader';
import {
	MCP_MAX_SCHEMA_BYTES,
	MCP_MAX_TOOLS,
} from '../../../../../src/main/agent/tools/mcp/limits';

const schema = { type: 'object', properties: {} };
const catalog = (...names: string[]) => names.map((name) => ({ name, inputSchema: schema }));

describe('loadMcpTools from persisted catalog', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getMcpServersMock.mockReturnValue({
			safe: { type: 'http', url: 'https://mcp.test', defer_loading: false },
		});
		getMcpToolCatalogMock.mockReturnValue(catalog('lookup'));
		connectMock.mockImplementation(async (id: string) => ({ id }));
		closeMock.mockResolvedValue(undefined);
		callToolMock.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
	});

	it('exposes cached schemas without connecting or listing at run start', async () => {
		const result = await loadMcpTools();
		expect(result.tools.map((tool) => tool.id)).toEqual(['mcp__safe__lookup']);
		expect(result.diagnostics).toMatchObject({
			configuredServers: 1,
			enabledServers: 1,
			connectedServers: 0,
			listedTools: 0,
			loadedTools: 1,
		});
		expect(connectMock).not.toHaveBeenCalled();
		expect(listToolsMock).not.toHaveBeenCalled();
		await result.close();
		expect(closeMock).not.toHaveBeenCalled();
	});

	it('skips servers without a saved catalog and disabled servers', async () => {
		getMcpServersMock.mockReturnValue({
			missing: { type: 'http', url: 'https://missing.test' },
			disabled: { type: 'http', url: 'https://disabled.test', enabled: false },
			safe: { type: 'http', url: 'https://safe.test' },
		});
		getMcpToolCatalogMock.mockImplementation((id: string) =>
			id === 'safe' ? catalog('lookup') : undefined
		);
		const result = await loadMcpTools();
		expect(result.tools.map((tool) => tool.id)).toEqual(['mcp__safe__lookup']);
		expect(getMcpToolCatalogMock).not.toHaveBeenCalledWith('disabled');
		expect(connectMock).not.toHaveBeenCalled();
		expect(listToolsMock).not.toHaveBeenCalled();
	});

	it('rejects invalid and oversized schemas and caps the cached tool count', async () => {
		getMcpToolCatalogMock.mockReturnValue([
			{ name: 'invalid', inputSchema: { type: 'invalid' } },
			{ name: 'oversized', inputSchema: { type: 'object', description: 'x'.repeat(MCP_MAX_SCHEMA_BYTES) } },
			...catalog(...Array.from({ length: MCP_MAX_TOOLS + 10 }, (_, index) => `tool-${index}`)),
		]);
		const result = await loadMcpTools();
		expect(result.tools).toHaveLength(MCP_MAX_TOOLS);
		expect(result.diagnostics).toMatchObject({
			listedTools: 0,
			loadedTools: MCP_MAX_TOOLS,
			rejectedTools: 12,
			truncated: true,
			failures: [
				{ serverId: 'safe', phase: 'schema', toolName: 'invalid' },
				{ serverId: 'safe', phase: 'schema', toolName: 'oversized' },
				{ serverId: 'safe', phase: 'limit' },
			],
		});
	});

	it('normalizes callable names while retaining original execution identities', async () => {
		getMcpToolCatalogMock.mockReturnValue(catalog('do thing', 'do@thing', 'x'.repeat(100)));
		const result = await loadMcpTools();
		const names = result.tools.map((tool) => tool.id);
		expect(new Set(names).size).toBe(names.length);
		expect(names[0]).toBe('mcp__safe__do_thing');
		for (const name of names) {
			expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
			expect(name.length).toBeLessThanOrEqual(64);
		}
		expect(result.tools[0].policy).toEqual({
			kind: 'mcp',
			serverId: 'safe',
			toolName: 'do thing',
		});
		await result.tools[0].run({});
		expect(callToolMock).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'safe' }),
			'do thing',
			{},
			expect.any(Number),
			undefined
		);
		expect(listToolsMock).not.toHaveBeenCalled();
		await result.close();
		expect(closeMock).toHaveBeenCalledTimes(1);
	});

	it('connects once when multiple selected tools on a server execute', async () => {
		getMcpToolCatalogMock.mockReturnValue(catalog('first', 'second'));
		const result = await loadMcpTools();
		await Promise.all(result.tools.map((tool) => tool.run({})));
		expect(connectMock).toHaveBeenCalledTimes(1);
		expect(callToolMock).toHaveBeenCalledTimes(2);
		expect(result.diagnostics.connectedServers).toBe(1);
		expect(listToolsMock).not.toHaveBeenCalled();
		await result.close();
		await result.close();
		expect(closeMock).toHaveBeenCalledTimes(1);
	});

	it('preserves read-only annotations and approval gates', async () => {
		getMcpToolCatalogMock.mockReturnValue([
			{ name: 'lookup', inputSchema: schema, annotations: { readOnlyHint: true } },
			{ name: 'write', inputSchema: schema },
		]);
		const result = await loadMcpTools();
		expect(result.tools.map((tool) => tool.capability)).toEqual([
			{ effects: ['read'], approval: false },
			{ effects: ['external'], approval: true },
		]);
		expect(connectMock).not.toHaveBeenCalled();
	});

	it('retries a failed lazy connection on the next selected call', async () => {
		connectMock
			.mockRejectedValueOnce(new Error('unavailable'))
			.mockResolvedValueOnce({ id: 'safe' });
		const result = await loadMcpTools();
		await expect(result.tools[0].run({})).rejects.toThrow('unavailable');
		await expect(result.tools[0].run({})).resolves.toBe('ok');
		expect(connectMock).toHaveBeenCalledTimes(2);
		expect(listToolsMock).not.toHaveBeenCalled();
		await result.close();
		expect(closeMock).toHaveBeenCalledTimes(1);
	});

	it('closes a connection that completes after the run ends', async () => {
		let resolveConnection: ((client: { id: string }) => void) | undefined;
		connectMock.mockImplementation(
			() => new Promise((resolve) => { resolveConnection = resolve; })
		);
		const result = await loadMcpTools();
		const execution = result.tools[0].run({});
		const closing = result.close();
		resolveConnection?.({ id: 'safe' });
		await expect(execution).rejects.toThrow('MCP run has ended');
		await closing;
		expect(closeMock).toHaveBeenCalledTimes(1);
		expect(callToolMock).not.toHaveBeenCalled();
	});

	it('respects an already aborted run without reading catalogs', async () => {
		const controller = new AbortController();
		controller.abort(new Error('cancel'));
		await expect(loadMcpTools(controller.signal)).rejects.toThrow('cancel');
		expect(getMcpToolCatalogMock).not.toHaveBeenCalled();
	});
});
