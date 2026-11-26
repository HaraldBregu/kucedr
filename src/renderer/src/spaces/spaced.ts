import { DEFAULT_WORKSPACE } from '@shared/workspaces_types';
import { active } from './active';

export function spaced(url: URL): URL {
	if (url.protocol === 'local-resource:' && url.host === 'agent' && active.id !== DEFAULT_WORKSPACE)
		url.searchParams.set('workspace', active.id);
	return url;
}
