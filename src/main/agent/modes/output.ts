export function isEnvelopeValid(content: string, tag: string): boolean {
	const value = content.trim();
	const opening = `<${tag}>`;
	const closing = `</${tag}>`;
	if (!value.startsWith(opening) || !value.endsWith(closing)) return false;
	if (value.indexOf(opening, opening.length) !== -1) return false;
	if (value.indexOf(closing) !== value.length - closing.length) return false;
	return value.slice(opening.length, -closing.length).trim().length > 0;
}
