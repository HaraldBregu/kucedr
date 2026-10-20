import path from 'node:path';
import { scanPlugins } from './plugins_scan';
import { pluginsStore } from './plugins_store';
import { serveExtensionFile } from './plugins_extension_serve';

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
		return await serveExtensionFile(
			path.join(plugin.directory, 'extensions', extensionId),
			rest,
			request
		);
	} catch {
		return new Response(null, { status: 404 });
	}
}
