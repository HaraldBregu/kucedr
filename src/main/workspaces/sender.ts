import type { WebContents } from 'electron';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { boundWorkspaces } from './bound';
import { resolveWorkspace } from './resolve';
import type { Workspace } from './types';

export function senderWorkspace(sender: WebContents): Workspace | undefined {
	try {
		return resolveWorkspace(boundWorkspaces.get(sender.id) ?? DEFAULT_WORKSPACE);
	} catch {
		return undefined;
	}
}
