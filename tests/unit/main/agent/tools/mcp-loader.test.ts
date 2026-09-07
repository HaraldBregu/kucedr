const connectMock = jest.fn();
const listToolsMock = jest.fn();
const closeMock = jest.fn();
const getMcpServersMock = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	connect: (...args: unknown[]) => connectMock(...args),
	listTools: (...args: unknown[]) => listToolsMock(...args),
	close: (...args: unknown[]) => closeMock(...args),
	getMcpServers: () => getMcpServersMock(),
}));

import { loadMcpTools } from '../../../../../src/main/agent/tools/mcp/loader';
import {
	MCP_MAX_SCHEMA_BYTES,
	MCP_MAX_TOOLS,
} from '../../../../../src/main/agent/tools/mcp/limits';

describe('loadMcpTools', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		connectMock.mockResolvedValue({});
		closeMock.mockResolvedValue(undefined);
		getMcpServersMock.mockReturnValue({ safe: { type: 'http', url: 'https://mcp.test' } });
	});

	it('rejects invalid and oversized schemas and caps the total tool count', async () => {
		listToolsMock.mockResolvedValue({
			tools: [
				{ name: 'invalid', inputSchema: { type: 'invalid' } },
				{
					name: 'oversized',
					inputSchema: { type: 'object', description: 'x'.repeat(MCP_MAX_SCHEMA_BYTES) },
				},
				...Array.from({ length: MCP_MAX_TOOLS + 10 }, (_, index) => ({
					name: `tool-${index}`,
					inputSchema: { type: 'object', properties: {} },
				})),
			],
		});

		const result = await loadMcpTools();
		expect(result.tools).toHaveLength(MCP_MAX_TOOLS);
		expect(result.tools.map((tool) => tool.id)).not.toEqual(
			expect.arrayContaining(['mcp__safe__invalid', 'mcp__safe__oversized'])
		);
		expect(result.diagnostics).toMatchObject({
			configuredServers: 1,
			enabledServers: 1,
			connectedServers: 1,
			listedTools: MCP_MAX_TOOLS + 12,
			loadedTools: MCP_MAX_TOOLS,
			rejectedTools: 12,
			truncated: true,
		});
		expect(result.diagnostics.failures).toEqual([
			{ serverId: 'safe', phase: 'schema', toolName: 'invalid' },
			{ serverId: 'safe', phase: 'schema', toolName: 'oversized' },
			{ serverId: 'safe', phase: 'limit' },
		]);
		await result.close();
		expect(closeMock).toHaveBeenCalledTimes(1);
	});

	it('normalizes provider names and resolves collisions deterministically', async () => {
		listToolsMock.mockResolvedValue({
			tools: [
				{ name: 'do thing', inputSchema: { type: 'object' } },
				{ name: 'do@thing', inputSchema: { type: 'object' } },
				{ name: 'x'.repeat(100), inputSchema: { type: 'object' } },
			],
		});

		const result = await loadMcpTools();
		const names = result.tools.map((tool) => tool.id);
		expect(new Set(names)).toHaveProperty('size', names.length);
		expect(names[0]).toBe('mcp__safe__do_thing');
		for (const name of names) {
			expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
			expect(name.length).toBeLessThanOrEqual(64);
		}
		expect(result.diagnostics).toMatchObject({ loadedTools: 3, failures: [] });
	});

	it('preserves read-only annotations and gates tools without them', async () => {
		listToolsMock.mockResolvedValue({
			tools: [
				{ name: 'lookup', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
				{ name: 'write', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false } },
				{ name: 'unknown', inputSchema: { type: 'object' } },
			],
		});

		const result = await loadMcpTools();
		expect(result.tools.map((configured) => configured.capability)).toEqual([
			{ effects: ['read'], approval: false },
			{ effects: ['external'], approval: true },
			{ effects: ['external'], approval: true },
		]);
	});

	it('reports connection and listing failures without exposing raw errors', async () => {
		getMcpServersMock.mockReturnValue({
			connects: { type: 'http', url: 'https://connects.test' },
			lists: { type: 'http', url: 'https://lists.test' },
		});
		connectMock.mockImplementation(async (id: string) => {
			if (id === 'connects') throw new Error('secret connection detail');
			return { id };
		});
		listToolsMock.mockRejectedValue(new Error('secret listing detail'));

		const result = await loadMcpTools();

		expect(result.tools).toEqual([]);
		expect(result.diagnostics).toMatchObject({
			configuredServers: 2,
			enabledServers: 2,
			connectedServers: 1,
			listedTools: 0,
			loadedTools: 0,
			rejectedTools: 0,
			truncated: false,
			failures: [
				{ serverId: 'connects', phase: 'connect' },
				{ serverId: 'lists', phase: 'list' },
			],
		});
		expect(JSON.stringify(result.diagnostics)).not.toContain('secret');
		expect(closeMock).toHaveBeenCalledTimes(1);
		await result.close();
		expect(closeMock).toHaveBeenCalledTimes(1);
	});

	it('starts discovery for enabled servers concurrently', async () => {
		getMcpServersMock.mockReturnValue({
			first: { type: 'http', url: 'https://first.test' },
			second: { type: 'http', url: 'https://second.test' },
		});
		let releaseFirst: (() => void) | undefined;
		const firstConnected = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		connectMock.mockImplementation(async (id: string) => {
			if (id === 'first') await firstConnected;
			return { id };
		});
		listToolsMock.mockResolvedValue({ tools: [] });

		const loading = loadMcpTools();
		expect(connectMock).toHaveBeenCalledTimes(2);
		releaseFirst?.();
		await expect(loading).resolves.toMatchObject({ tools: [] });
	});
});

it('closes every acquired client if discovery postprocessing fails', async () => {
	jest.clearAllMocks();
	getMcpServersMock.mockReturnValue({
		one: { type: 'http', url: 'https://one.test' },
		two: { type: 'http', url: 'https://two.test' },
	});
	connectMock.mockImplementation(async (id: string) => ({ id }));
	closeMock.mockResolvedValue(undefined);
	listToolsMock.mockResolvedValue({ tools: null });
	await expect(loadMcpTools()).rejects.toThrow();
	expect(closeMock).toHaveBeenCalledTimes(2);
});

it('closes acquired clients exactly once on cancellation during listing', async () => {
	jest.clearAllMocks();
	const controller = new AbortController();
	getMcpServersMock.mockReturnValue({ one: { type: 'http', url: 'https://one.test' } });
	connectMock.mockResolvedValue({ id: 'one' });
	closeMock.mockResolvedValue(undefined);
	listToolsMock.mockImplementation(async () => {
		controller.abort(new Error('cancel'));
		throw controller.signal.reason;
	});
	await expect(loadMcpTools(controller.signal)).rejects.toThrow('cancel');
	expect(closeMock).toHaveBeenCalledTimes(1);
});
