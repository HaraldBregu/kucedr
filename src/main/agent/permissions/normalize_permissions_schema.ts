import type { PermissionRules, PermissionsSchema } from './permissions_types';

export function normalizePermissionsSchema(
	value: unknown,
	fallback: PermissionsSchema
): PermissionsSchema {
	const stored =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const rules = (candidate: unknown, otherwise: PermissionRules): PermissionRules => {
		const entry =
			candidate && typeof candidate === 'object' && !Array.isArray(candidate)
				? (candidate as Record<string, unknown>)
				: {};
		const list = (items: unknown, defaults: string[]): string[] =>
			Array.isArray(items)
				? [
						...new Set(
							items
								.filter((item): item is string => typeof item === 'string')
								.map((item) => item.trim())
								.filter(Boolean)
						),
					]
				: [...defaults];
		return { allow: list(entry.allow, otherwise.allow), deny: list(entry.deny, otherwise.deny) };
	};
	return {
		read: rules(stored.read, fallback.read),
		write: rules(stored.write, fallback.write),
		exec: rules(stored.exec, fallback.exec),
		...(stored.tools && typeof stored.tools === 'object' && !Array.isArray(stored.tools)
			? {
					tools: Object.fromEntries(
						Object.entries(stored.tools).filter(
							([, mode]) => mode === 'ask' || mode === 'allow' || mode === 'deny'
						)
					),
				}
			: {}),
	};
}
