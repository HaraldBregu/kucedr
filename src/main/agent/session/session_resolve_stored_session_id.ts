import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import type { SessionCategory } from './session_types';
import { DEFAULT_CATEGORY } from './session_types';
import { isUuid } from './session_is_uuid';
import { latestUuidSessionId } from './session_latest_uuid_session_id';

export function resolveStoredSessionId(
	sessionId: string,
	root?: string,
	category: SessionCategory = DEFAULT_CATEGORY,
	workspace: string = DEFAULT_WORKSPACE
): string {
	if (isUuid(sessionId) || !root) return sessionId;
	return latestUuidSessionId(root, category, workspace) ?? sessionId;
}
