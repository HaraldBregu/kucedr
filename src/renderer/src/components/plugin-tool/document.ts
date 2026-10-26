import type { AppThemeData } from '@kucedr/sdk';

const CSP =
	"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:\">";

export function pluginToolDocument(html: string, theme: AppThemeData): string {
	const colors = Object.entries(theme.colors).map(([name, value]) => `--${name}:${value}`).join(';');
	const head = `${CSP}<style>:root{color-scheme:${theme.isDark ? 'dark' : 'light'};${colors}}</style>`;
	return /<head[^>]*>/i.test(html)
		? html.replace(/<head[^>]*>/i, (tag) => tag + head)
		: head + html;
}
