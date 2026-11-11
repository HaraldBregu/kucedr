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
	return undefined;
}
