export function resolveMcpServerHint(
	message: string,
	servers: Array<{ serverId: string; serverName: string }>
): string | undefined {
	const normalized = message.toLocaleLowerCase();
	for (const server of servers) {
		for (const name of [server.serverId, server.serverName]) {
			const candidate = name.trim().toLocaleLowerCase();
			if (!candidate) continue;
			const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(normalized))
				return server.serverId.toLocaleLowerCase();
		}
	}
	const explicit = normalized.match(/\b([\p{L}\p{N}_-]+)\s+mcp\b/u)?.[1];
	if (
		!explicit ||
		['a', 'an', 'check', 'my', 'server', 'the', 'tool', 'tools', 'use', 'using'].includes(explicit)
	)
		return undefined;
	return explicit;
}
