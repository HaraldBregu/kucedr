export function appendMemory(markdown: string, fact: string): string {
	const lines = markdown.trimEnd().split('\n');
	const start = lines.findIndex((line) => /^#{1,6}\s+facts\s*$/i.test(line));
	if (start < 0)
		return `${markdown.trimEnd()}${markdown.trim() ? '\n\n' : ''}## Facts\n- ${fact}\n`;
	let end = lines.findIndex((line, index) => index > start && /^#{1,6}\s/.test(line));
	if (end < 0) end = lines.length;
	while (end > start + 1 && !lines[end - 1].trim()) end -= 1;
	lines.splice(end, 0, `- ${fact}`);
	return `${lines.join('\n')}\n`;
}
