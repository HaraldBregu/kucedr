const TAG = '[｜|]+\\s*DSML\\s*[｜|]+\\s*';
const BLOCK = new RegExp(
	`^<${TAG}[^\\s>]*calls\\s*>([\\s\\S]*)</${TAG}[^\\s>]*calls\\s*>\\s*$`
);
const INVOKE = new RegExp(
	`<${TAG}invoke\\s+name="([^"]+)"\\s*>([\\s\\S]*?)</${TAG}invoke\\s*>`,
	'g'
);
const PARAMETER = new RegExp(
	`<${TAG}parameter\\s+name="([^"]+)"(?:\\s+string="(true|false)")?\\s*>([\\s\\S]*?)</${TAG}parameter\\s*>`,
	'g'
);

export function invokes(
	text: string
): Array<{ name: string; args: Record<string, unknown> }> | undefined {
	const body = BLOCK.exec(text)?.[1];
	if (!body || body.replace(INVOKE, '').trim()) return undefined;
	const calls = [...body.matchAll(INVOKE)].map(([, name, parameters]) => {
		const args: Record<string, unknown> = {};
		for (const [, key, string, value] of parameters.matchAll(PARAMETER)) {
			args[key] = value;
			if (string !== 'false') continue;
			try {
				args[key] = JSON.parse(value);
			} catch {
				args[key] = value;
			}
		}
		return { name, args };
	});
	return calls.length > 0 ? calls : undefined;
}
