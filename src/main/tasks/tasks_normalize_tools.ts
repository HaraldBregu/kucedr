const TOOL_NAME = /^[a-z][a-z0-9_-]{0,63}$/;

export function normalizeTools(toolsAllow: readonly string[]): string[] {
	const normalized = [...new Set(toolsAllow.map((name) => name.trim()).filter(Boolean))];
	if (normalized.length > 32 || normalized.some((name) => !TOOL_NAME.test(name))) {
		throw new Error('Schedule tool allowlist is invalid.');
	}
	return normalized;
}
