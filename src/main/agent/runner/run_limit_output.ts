const SUFFIX = '\n[tool output truncated]';

export function limitToolOutput(output: unknown, maxBytes: number): unknown {
	let text: string;
	if (typeof output === 'string') text = output;
	else {
		try {
			text = JSON.stringify(output) ?? String(output);
		} catch {
			text = String(output);
		}
	}
	if (Buffer.byteLength(text, 'utf8') <= maxBytes) return output;
	const prefixBytes = Math.max(0, maxBytes - Buffer.byteLength(SUFFIX, 'utf8'));
	const prefix = Buffer.from(text).subarray(0, prefixBytes).toString('utf8').replace(/�$/, '');
	return `${prefix}${SUFFIX}`;
}
