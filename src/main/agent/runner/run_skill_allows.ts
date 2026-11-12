export function skillAllows(scopes: ReadonlyArray<string[] | undefined>, toolId: string): boolean {
	return scopes.every(
		(allowed) =>
			!allowed ||
			toolId === 'load_skill' ||
			(toolId !== 'subagent' && toolId !== 'subagents' && allowed.includes(toolId))
	);
}
