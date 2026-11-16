import { net } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listModes } from './list';

const CSP =
	"default-src 'none'; script-src kucedr-mode: 'unsafe-inline'; style-src kucedr-mode: 'unsafe-inline'; img-src kucedr-mode: data: blob:; font-src kucedr-mode: data:; media-src kucedr-mode: data: blob:; worker-src blob:";

/** Serves `kucedr-mode://<mode-id>/<path>` from that mode's `background/` folder, with no network. */
export async function modeBackgroundResponse(request: Request): Promise<Response> {
	try {
		const url = new URL(request.url);
		const root = listModes().find(({ id }) => id === url.host)?.background;
		if (!root) return new Response(null, { status: 404 });
		const resolvedRoot = await fs.realpath(root);
		const target = await fs.realpath(
			path.resolve(root, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html')
		);
		const relative = path.relative(resolvedRoot, target);
		if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
			return new Response(null, { status: 403 });
		}
		const response = await net.fetch(pathToFileURL(target).toString());
		const headers = new Headers(response.headers);
		headers.set('Content-Security-Policy', CSP);
		headers.set('Access-Control-Allow-Origin', '*');
		return new Response(response.body, { status: response.status, headers });
	} catch {
		return new Response(null, { status: 404 });
	}
}
