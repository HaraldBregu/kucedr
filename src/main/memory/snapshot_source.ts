import { fingerprint } from './fingerprint';
import type { SourceSession } from './types';

export function snapshotSource(sessionId: string, markdown: string): SourceSession {
	const legacy = markdown.startsWith(
		`# Session ${sessionId}\n\n<!-- kucedr-memory-session:v1 -->\n`
	);
	if (
		!legacy &&
		!new RegExp(
			`^# Session ${sessionId}\\n\\n\\*\\*Date:\\*\\* \\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z\\n`
		).test(markdown)
	)
		throw new Error('A memory session file could not be read; memory processing will retry.');
	const pattern = legacy
		? /<!-- kucedr-message:(user|assistant) -->\n([\s\S]*?)\n<!-- \/kucedr-message -->/g
		: /\*\*(User|Assistant):\*\*\n((?:>[^\n]*(?:\n|$))+)/g;
	const occurrences = new Map<string, number>();
	const date = markdown.match(/^# Session [^\n]+\n\n\*\*Date:\*\* ([^\n]+)\n/)?.[1];
	const source: SourceSession = { id: sessionId, ...(date ? { updatedAt: date } : {}), messages: [] };
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(markdown))) {
		const lines = match[2].replace(/\n$/, '').split('\n');
		if (lines.some((line) => line !== '>' && !line.startsWith('> ')))
			throw new Error('A memory session file could not be read; memory processing will retry.');
		const text = lines.map((line) => (line === '>' ? '' : line.slice(2))).join('\n');
		if (!text.trim()) continue;
		const role = match[1].toLowerCase() as 'user' | 'assistant';
		const digest = fingerprint(`${role}:${text}`);
		const occurrence = occurrences.get(digest) ?? 0;
		occurrences.set(digest, occurrence + 1);
		for (let offset = 0; offset < text.length; offset += 4000) {
			source.messages.push({
				fingerprint: fingerprint(`${digest}:${occurrence}:${offset}`),
				role,
				text: text.slice(offset, offset + 4000),
			});
		}
	}
	const stripped = markdown.replace(pattern, '').trim();
	if (
		legacy
			? stripped !== `# Session ${sessionId}\n\n<!-- kucedr-memory-session:v1 -->`
			: !new RegExp(
					`^# Session ${sessionId}\\n\\n\\*\\*Date:\\*\\* \\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`
				).test(stripped)
	)
		throw new Error('A memory session file could not be read; memory processing will retry.');
	return source;
}
