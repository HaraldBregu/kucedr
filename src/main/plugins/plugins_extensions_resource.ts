import { extensionFolder } from './plugins_extensions_folder';
import { serveExtensionFile } from './plugins_extension_serve';

/** Serves `kucedr-extension://<extension-id>/<file>` from an imported extension's folder. */
export async function handleStandaloneExtensionResource(request: Request): Promise<Response> {
	try {
		const url = new URL(request.url);
		const rest = decodeURIComponent(url.pathname).replace(/^\/+/, '').split('/');
		const folder = extensionFolder(url.host);
		if (!folder || !rest[0]) return new Response(null, { status: 403 });
		return await serveExtensionFile(folder, rest, request);
	} catch {
		return new Response(null, { status: 404 });
	}
}
