import { mcpAuthorizationRequired } from '../../../../../src/main/agent/runner/mcp_authorization_required';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

const mcp = jsonTool({
	id: 'mcp__gmail__lookup',
	name: 'Lookup',
	description: 'Lookup Gmail',
	policy: { kind: 'mcp', serverId: 'gmail', toolName: 'lookup' },
	schema: { type: 'object' },
	execute: () => undefined,
});

it('accepts only a structured authorization result for the called MCP server', () => {
	const marker = { status: 'authorization_required', serverId: 'gmail', serverName: 'Gmail' };
	expect(mcpAuthorizationRequired(mcp, marker)).toEqual(marker);
	expect(mcpAuthorizationRequired(mcp, JSON.stringify(marker))).toBeUndefined();
	expect(mcpAuthorizationRequired(mcp, { ...marker, serverId: 'other' })).toBeUndefined();
});
