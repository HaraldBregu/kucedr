import { currentWorkspace } from '../../../../workspaces/current';
import { paneTabs, type BrowserTab } from './pane';

export function findTab(id: string): BrowserTab | undefined {
	const tab = paneTabs.get(id);
	return tab?.workspace.id === currentWorkspace().id ? tab : undefined;
}
