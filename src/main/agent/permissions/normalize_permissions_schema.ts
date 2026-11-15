import path from 'node:path';
import { literalRule } from './literal_rule';
import type {
	PermissionBucket,
	PermissionKind,
	PermissionRule,
	PermissionRules,
	PermissionsSchema,
} from './permissions_types';

export function normalizePermissionsSchema(value: unknown): {
	permissions: PermissionsSchema;
	dropped: string[];
} {
	const record = (candidate: unknown): Record<string, unknown> =>
		candidate && typeof candidate === 'object' && !Array.isArray(candidate)
			? (candidate as Record<string, unknown>)
			: {};
	const dropped: string[] = [];
	const list = (items: unknown, bucket: PermissionBucket): PermissionRule[] => {
		const rules = (Array.isArray(items) ? items : []).flatMap((item) => {
			const entry = record(item);
			const text = (
				typeof item === 'string'
					? item
					: typeof entry.root === 'string' && entry.root.trim()
						? entry.recursive === true
							? path.join(entry.root.trim(), '**')
							: entry.root
						: ''
			).trim();
			if (!text) return [];
			const rule = literalRule(text, bucket);
			if (!rule) dropped.push(text);
			else if (rule.recursive && path.join(rule.root, '**') !== path.resolve(text) && rule.root !== path.resolve(text))
				dropped.push(`${text} → ${rule.root}`);
			return rule ? [rule] : [];
		});
		return [...new Map(rules.map((rule) => [`${rule.recursive}:${rule.root}`, rule])).values()];
	};
	const rules = (kind: PermissionKind): PermissionRules => {
		const entry = record(record(value)[kind]);
		return { allow: list(entry.allow, 'allow'), deny: list(entry.deny, 'deny') };
	};
	return {
		permissions: { read: rules('read'), write: rules('write'), exec: rules('exec') },
		dropped: [...new Set(dropped)],
	};
}
