const callToolMock = jest.fn();
const getMcpServersMock = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	callTool: (...args: unknown[]) => callToolMock(...args),
	getMcpServers: () => getMcpServersMock(),
}));
jest.mock('../../../../../src/main/mcp/manifest', () => ({ findMcpService: () => undefined }));

import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { mcpTool } from '../../../../../src/main/agent/tools/mcp/tool';
import { MCP_MAX_OUTPUT_BYTES } from '../../../../../src/main/agent/tools/mcp/limits';
import type { McpClient } from '../../../../../src/main/mcp';

const client = {} as McpClient;
const schema = {
	type: 'object',
	properties: { query: { type: 'string' } },
	required: ['query'],
} as const;

describe('mcpTool', () => {
	beforeEach(() => {
		callToolMock.mockReset();
		getMcpServersMock.mockReturnValue({});
	});

	it('uses stable runtime IDs without forcing approval in the tool definition', () => {
		for (const approval of ['never', 'always', undefined] as const) {
			const configured = mcpTool(client, 'lookup', '', schema, 'safe', approval);
			expect(configured.id).toBe('mcp__safe__lookup');
			expect(configured.hardApproval).toBeUndefined();
		}
	});

	it.each([
		[undefined, true, false],
		[undefined, false, true],
		['always', true, true],
		['always', false, true],
		['never', true, false],
		['never', false, false],
	] as const)('applies approval policy %s to read-only hint %s', (approval, readOnly, requiresApproval) => {
		const configured = mcpTool(client, 'lookup', '', schema, 'safe', approval, undefined, readOnly);
		expect(configured.capability).toEqual({
			effects: readOnly ? ['read'] : ['external'],
			approval: requiresApproval,
		});
	});

	it('requires default approval when read-only metadata is absent', () => {
		const configured = mcpTool(client, 'lookup', '', schema, 'safe');
		expect(configured.capability).toEqual({ effects: ['external'], approval: true });
	});

	it('validates inputs and forwards timeout plus cancellation to the SDK', async () => {
		callToolMock.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
		const signal = new AbortController().signal;
		const tool = mcpTool(client, 'lookup', '', schema, 'safe', 'never');

		expect(() => tool.parseInput({ query: 1 })).toThrow();
		const input = tool.parseInput({ query: 'Kucedr' });
		await expect(tool.run(input, signal)).resolves.toBe('ok');
		expect(callToolMock).toHaveBeenCalledWith(client, 'lookup', input, 30_000, signal);
	});

	it('caps successful and error output before returning it', async () => {
		const text = 'x'.repeat(MCP_MAX_OUTPUT_BYTES * 2);
		const tool = mcpTool(client, 'lookup', '', schema, 'safe', 'never');
		callToolMock.mockResolvedValueOnce({ content: [{ type: 'text', text }] });
		const output = await tool.run({ query: 'Kucedr' });
		expect(Buffer.byteLength(String(output), 'utf8')).toBeLessThanOrEqual(MCP_MAX_OUTPUT_BYTES);
		expect(output).toContain('[truncated:');

		callToolMock.mockResolvedValueOnce({ isError: true, content: [{ type: 'text', text }] });
		await expect(tool.run({ query: 'Kucedr' })).rejects.toThrow('[truncated:');
	});

	it('turns an MCP authorization failure into an in-chat authorization request', async () => {
		getMcpServersMock.mockReturnValue({ safe: { type: 'http', name: 'Documents', url: 'https://mcp.example' } });
		callToolMock.mockRejectedValue(new UnauthorizedError());
		const configured = mcpTool(client, 'lookup', '', schema, 'safe', 'never');

		await expect(configured.run({ query: 'Kucedr' })).resolves.toBe(
			JSON.stringify({ status: 'authorization_required', serverId: 'safe', serverName: 'Documents', message: 'Call request_mcp_authorization for this server to display the chat button, then wait for the user before using its tools.' })
		);
	});
});
