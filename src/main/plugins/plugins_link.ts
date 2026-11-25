import { LinkBroker } from '../cloud/links';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function pluginLinkId(url: URL): string | null {
	if (url.protocol !== 'kucedr:' || url.hostname !== 'plugins' || url.search || url.hash)
		return null;
	const id = url.pathname.replace(/^\/|\/$/g, '');
	return ID.test(id) ? id : null;
}

export const pluginLinks = new LinkBroker((url) => pluginLinkId(url) !== null);
