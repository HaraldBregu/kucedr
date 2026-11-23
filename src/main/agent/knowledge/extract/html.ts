import { markupText } from './markup';

export function htmlText(html: string): string {
	return markupText(
		html.replace(/<!--[\s\S]*?-->|<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ''),
		/<br\b[^>]*>|<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|pre|table|ul|ol|dd|dt)\s*>/gi,
		/<\/t[dh]\s*>/gi
	);
}
