import { net } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Serves a file inside an extension folder, refusing paths that escape it. */
export async function serveExtensionFile(
	folder: string,
	rest: string[],
	request: Request
): Promise<Response> {
	const root = await fs.realpath(folder);
	const target = await fs.realpath(path.resolve(root, ...rest));
	const relative = path.relative(root, target);
	if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		return new Response(null, { status: 403 });
	}
	const file = await net.fetch(pathToFileURL(target).toString(), { headers: request.headers });
	const headers = new Headers(file.headers);
	// ponytail: no network for extensions until the permissions bridge exists
	headers.set(
		'Content-Security-Policy',
		"default-src 'none'; script-src kucedr-plugin: kucedr-extension:; style-src kucedr-plugin: kucedr-extension: 'unsafe-inline'; img-src kucedr-plugin: kucedr-extension: data:; font-src kucedr-plugin: kucedr-extension: data:"
	);
	return new Response(file.body, { status: file.status, headers });
}
