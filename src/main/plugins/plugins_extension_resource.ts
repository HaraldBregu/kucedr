import { net } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanPlugins } from './plugins_scan';
import { pluginsStore } from './plugins_store';

/** Serves `kucedr-plugin://<plugin-id>/<extension-id>/<file>` from an enabled plugin's extension folder. */
export async function handleExtensionResource(request: Request): Promise<Response> {
	try {
		const url = new URL(request.url);
		const [extensionId, ...rest] = decodeURIComponent(url.pathname).replace(/^\/+/, '').split('/');
		const plugin = scanPlugins().find((item) => item.id === url.host);
		if (
			!plugin?.manifest ||
			pluginsStore.get('disabled').includes(plugin.id) ||
			!plugin.manifest.contributes.extensions.includes(extensionId) ||
			rest.length === 0
		) {
			return new Response(null, { status: 403 });
		}
		const root = await fs.realpath(path.join(plugin.directory, 'extensions', extensionId));
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
			"default-src 'none'; script-src kucedr-plugin:; style-src kucedr-plugin: 'unsafe-inline'; img-src kucedr-plugin: data:; font-src kucedr-plugin: data:"
		);
		return new Response(file.body, { status: file.status, headers });
	} catch {
		return new Response(null, { status: 404 });
	}
}
