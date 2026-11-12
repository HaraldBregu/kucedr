export function breakpoint(
	system: string,
	enabled: boolean | undefined
): string | Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> {
	return enabled && system ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : system;
}
