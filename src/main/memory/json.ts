export function normalizeJson(raw: string): string {
	const trimmed = raw.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	const candidate = fenced?.[1]?.trim() ?? trimmed;
	JSON.parse(candidate);
	return candidate;
}
