import { z } from 'zod';
import { responseText } from '../../../body';
import { publicRequest } from '../../../request';
import { tool } from '../tool';

const MAX_CHARS_DEFAULT = 20_000;
const TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1_000_000;

// ponytail: regex-based HTML-to-text; add a readability lib if extraction quality matters
function htmlToText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)[^>]*>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s*\n+/g, '\n\n')
		.trim();
}

export const fetchWebPageTool = tool({
	id: 'fetch_web_page',
	category: 'web',
	name: 'Fetch web page',
	description:
		'Fetch an HTTP(S) URL and return its readable text content. HTML is converted to plain text; JSON is pretty-printed.',
	planSafe: true,
	inputSchema: z.object({
		url: z.string().url().describe('HTTP(S) URL to fetch.'),
		maxChars: z
			.number()
			.int()
			.min(100)
			.optional()
			.describe(
				`Max characters returned (default ${MAX_CHARS_DEFAULT}); longer content is truncated.`
			),
	}),
	execute: async ({ url, maxChars }, signal) => {
		let current = new URL(url);
		let res: Response;
		for (let hop = 0; ; hop++) {
			if (current.protocol !== 'http:' && current.protocol !== 'https:')
				throw new Error('Invalid URL: must be http or https');
			const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);
			const result = await publicRequest(current.toString(), {
				signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
				headers: {
					Accept: 'text/html, application/json;q=0.9, */*;q=0.1',
					'Accept-Language': 'en-US,en;q=0.9',
				},
			});
			res = result.response;
			current = result.url;
			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location)
					throw new Error(`fetch_web_page failed (${res.status}): missing Location header`);
				if (hop >= MAX_REDIRECTS) throw new Error('fetch_web_page failed: too many redirects');
				current = new URL(location, current);
				continue;
			}
			break;
		}
		if (!res.ok) throw new Error(`fetch_web_page failed (${res.status}): ${res.statusText}`);

		const contentType = res.headers.get('content-type') ?? '';
		const body = await responseText(res, MAX_RESPONSE_BYTES);

		let text = body;
		if (contentType.includes('text/html')) {
			text = htmlToText(body);
		} else if (contentType.includes('application/json')) {
			try {
				text = JSON.stringify(JSON.parse(body), null, 2);
			} catch {
				text = body;
			}
		}

		const limit = maxChars ?? MAX_CHARS_DEFAULT;
		const truncated = text.length > limit;
		if (truncated) text = text.slice(0, limit);

		return JSON.stringify(
			{ url, finalUrl: current.toString(), status: res.status, contentType, truncated, text },
			null,
			2
		);
	},
});
