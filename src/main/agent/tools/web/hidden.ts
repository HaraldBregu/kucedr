const TAG = /<(\/?)([a-z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTRIBUTE = /([^\s"'=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const END = String.raw`\s*(?:!important\s*)?(?:;|$)`;
const NONE = new RegExp(
	String.raw`(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0*\.?0+%?${END}|font-size\s*:\s*0*\.?0+[a-z%]*${END}|(?:left|top|right|text-indent|margin-left|margin-top)\s*:\s*-(?:\d{4,}|\d{3,}(?:\.\d+)?(?:r?em|v[wh]|%)))`,
	'i'
);
const ZERO = new RegExp(String.raw`(?:^|;)\s*(?:max-)?(?:width|height)\s*:\s*0*\.?0+[a-z%]*${END}`, 'i');
const CLIP = /(?:^|;)\s*overflow(?:-[xy])?\s*:\s*(?:hidden|clip)/i;

export function stripHidden(html: string): string {
	let text = '';
	let from = 0;
	let skip: { name: string; depth: number } | undefined;
	for (const match of html.matchAll(TAG)) {
		const [tag, closing, rawName, attributes] = match;
		const name = rawName.toLowerCase();
		if (VOID.has(name)) continue;
		if (skip) {
			if (name === skip.name) skip.depth += closing ? -1 : 1;
			if (skip.depth === 0) {
				skip = undefined;
				from = match.index + tag.length;
			}
			continue;
		}
		if (closing) continue;
		let hidden = name === 'template';
		for (const [, key, ...values] of attributes.matchAll(ATTRIBUTE)) {
			const value = values.find((part) => part !== undefined) ?? '';
			const attribute = key.toLowerCase();
			if (
				attribute === 'hidden' ||
				(attribute === 'aria-hidden' && value.trim().toLowerCase() === 'true') ||
				(attribute === 'style' && (NONE.test(value) || (ZERO.test(value) && CLIP.test(value))))
			)
				hidden = true;
		}
		if (!hidden) continue;
		text += html.slice(from, match.index);
		skip = { name, depth: 1 };
	}
	return skip ? text : text + html.slice(from);
}
