export function seekSequence(
	lines: string[],
	pattern: string[],
	start: number,
	eof: boolean
): number | null {
	if (pattern.length === 0) return start;
	if (pattern.length > lines.length) return null;
	const maxStart = lines.length - pattern.length;
	const searchStart = eof ? maxStart : start;
	if (searchStart > maxStart) return null;

	// ponytail: fuzzy fallbacks (trimEnd, then trim) tolerate whitespace drift in model output
	for (const normalize of [(v: string) => v, (v: string) => v.trimEnd(), (v: string) => v.trim()]) {
		for (let i = searchStart; i <= maxStart; i += 1) {
			if (pattern.every((p, idx) => normalize(lines[i + idx]) === normalize(p))) return i;
		}
	}
	return null;
}

