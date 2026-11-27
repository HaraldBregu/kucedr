import Store from 'electron-store';
import type { AgentMediaModelSettings } from '../../shared/agent_types';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { workspaceScope } from '../workspaces/scope';

const stores = new Map<string, Store<{ llm?: AgentMediaModelSettings }>>();

export function chatOverride(): Store<{ llm?: AgentMediaModelSettings }> | undefined {
	const workspace = workspaceScope.getStore();
	if (!workspace || workspace.id === DEFAULT_WORKSPACE) return undefined;
	let store = stores.get(workspace.id);
	if (!store) {
		store = new Store<{ llm?: AgentMediaModelSettings }>({
			name: `chat-${workspace.id}`,
			cwd: workspace.settings,
			accessPropertiesByDotNotation: false,
		});
		stores.set(workspace.id, store);
	}
	return store;
}
