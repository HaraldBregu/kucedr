const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
	const normalized = text.replace(/\r\n?/g, '\n').trim();
	if (!normalized) return [];

	const chunks: string[] = [];
	let current = '';

	for (const paragraph of normalized.split(/\n{2,}/)) {
		let section = paragraph.trim();
		if (!section) continue;
		if (current && current.length + section.length + 2 > CHUNK_SIZE) {
			chunks.push(current);
			current = current.slice(-CHUNK_OVERLAP).trim();
		}

		while (section.length > CHUNK_SIZE - current.length - (current ? 2 : 0)) {
			const available = CHUNK_SIZE - current.length - (current ? 2 : 0);
			const splitAt = Math.max(
				section.lastIndexOf('\n', available),
				section.lastIndexOf(' ', available)
			);
			const end = splitAt > 0 ? splitAt : available;
			const prefix = section.slice(0, end).trim();
			if (prefix) chunks.push([current, prefix].filter(Boolean).join('\n\n'));
			current = prefix.slice(-CHUNK_OVERLAP).trim();
			section = section.slice(end).trim();
		}

		current = [current, section].filter(Boolean).join('\n\n');
	}
	if (current) chunks.push(current);
	return chunks;
}
