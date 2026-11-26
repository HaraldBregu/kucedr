import type { SessionCategory } from './session_types';
import { DEFAULT_CATEGORY } from './session_types';
import { isUuid } from './session_is_uuid';
import { latestUuidSessionId } from './session_latest_uuid_session_id';

export function resolveStoredSessionId(
	sessionId: string,
	root?: string,
	category: SessionCategory = DEFAULT_CATEGORY
): string {
	if (isUuid(sessionId) || !root) return sessionId;
	return latestUuidSessionId(root, category) ?? sessionId;
}
