import { currentWorkspace } from '../../../../workspaces/current';
import { paneTabs, type BrowserTab } from './pane';

export function workspaceTabs(): BrowserTab[] {
	const { id } = currentWorkspace();
	return [...paneTabs.values()].filter((tab) => tab.workspace.id === id);
}
