export function metaContent(html: string, key: string): string {
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const patterns = [
		new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
		new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
	];
	return patterns.map((pattern) => html.match(pattern)?.[1]?.trim()).find(Boolean) ?? '';
}
