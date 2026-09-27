import type { Tool } from '../types';

export function canonicalToolId(tool: Tool): string {
	const policy = tool.policy;
	if (policy?.kind === 'mcp') {
		const server = encodeURIComponent(policy.serverId).replaceAll('.', '%2E');
		const name = encodeURIComponent(policy.toolName).replaceAll('.', '%2E');
		return `${server}.${name}`;
	}
	const namespace = ['read', 'write', 'edit', 'patch', 'undo', 'redo'].includes(tool.id)
		? 'files'
		: 'native';
	return `${namespace}.${encodeURIComponent(tool.id).replaceAll('.', '%2E')}`;
}
