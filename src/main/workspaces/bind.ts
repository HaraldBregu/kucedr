import type { WebContents } from 'electron';
import { boundWorkspaces } from './bound';
import { openWorkspace } from './open';
import { resolveWorkspace } from './resolve';

export function bindWorkspace(contents: WebContents, id: string): void {
	const workspace = resolveWorkspace(id);
	const key = contents.id;
	if (!boundWorkspaces.has(key)) contents.once('destroyed', () => boundWorkspaces.delete(key));
	boundWorkspaces.set(key, id);
	openWorkspace(workspace);
}
