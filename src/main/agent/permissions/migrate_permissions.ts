import { AGENT_TOOL_PROFILE_IDS } from '../../../shared/agent_tools';
import { getAgentProfileDocument, setAgentProfileDocument } from '../agent_profiles';
import { normalizePermissionsSchema } from './normalize_permissions_schema';
import { withoutDefaultPermissions } from './without_default_permissions';
import type { PermissionKind, PermissionRule } from './permissions_types';

const KINDS: PermissionKind[] = ['read', 'write', 'exec'];

export function migratePermissions(workspace: PermissionRule, library: PermissionRule): void {
	const legacy = (value: unknown): boolean =>
		KINDS.some((kind) =>
			(['allow', 'deny'] as const).some((bucket) => {
				const rules = (value as Record<string, Record<string, unknown> | undefined> | undefined)?.[kind]?.[bucket];
				return Array.isArray(rules) && rules.some((rule) => typeof rule === 'string');
			})
		);
	const pending = AGENT_TOOL_PROFILE_IDS.filter((profileId) => {
		const { permissions } = getAgentProfileDocument(profileId);
		return profileId === 'chat' ? legacy(permissions) : permissions !== undefined;
	});
	if (pending.length === 0) return;
	const same = (rule: PermissionRule) => (other: PermissionRule): boolean =>
		rule.root === other.root && rule.recursive === other.recursive;
	const { permissions: original, ...chat } = getAgentProfileDocument('chat');
	const converted = normalizePermissionsSchema(original);
	const shared = withoutDefaultPermissions(converted.permissions, workspace, library);
	const dropped = [...converted.dropped];
	for (const profileId of pending.filter((id) => id !== 'chat')) {
		const { permissions: stored, ...document } = getAgentProfileDocument(profileId);
		const profile = normalizePermissionsSchema(stored);
		const own = withoutDefaultPermissions(profile.permissions, workspace, library);
		dropped.push(...profile.dropped.map((rule) => `${rule} (${profileId})`));
		for (const kind of KINDS) {
			shared[kind].deny.push(...own[kind].deny.filter((rule) => !shared[kind].deny.some(same(rule))));
			dropped.push(
				...own[kind].allow
					.filter((rule) => !shared[kind].allow.some(same(rule)))
					.map((rule) => `${rule.root} (${profileId})`)
			);
		}
		setAgentProfileDocument(profileId, { ...document, legacyRules: document.legacyRules ?? stored });
	}
	const previous = Array.isArray(chat.droppedRules) ? chat.droppedRules : [];
	setAgentProfileDocument('chat', {
		...chat,
		permissions: shared,
		...(original === undefined ? {} : { legacyRules: chat.legacyRules ?? original }),
		...(dropped.length > 0 || previous.length > 0
			? { droppedRules: [...new Set([...previous, ...dropped])] }
			: {}),
	});
}
