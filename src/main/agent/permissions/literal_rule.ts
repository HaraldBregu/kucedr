import os from 'node:os';
import path from 'node:path';
import { resolveUserPath } from '../../shared/user_path';
import type { PermissionBucket, PermissionRule } from './permissions_types';

const GLOB = /[*?[\]{}]/;

export function literalRule(rule: string, bucket: PermissionBucket): PermissionRule | undefined {
	const resolved = rule === '*' ? `${path.parse(os.homedir()).root}**` : resolveUserPath(rule, os.homedir());
	const recursive = /[\\/]\*\*$/.test(resolved);
	const root = recursive ? path.dirname(resolved) : resolved;
	if (!GLOB.test(root)) return { root: path.resolve(root), recursive };
	if (bucket === 'allow') return undefined;
	const segments = root.split(/[\\/]/);
	return {
		root: path.resolve(
			`${segments.slice(0, segments.findIndex((segment) => GLOB.test(segment))).join(path.sep)}${path.sep}`
		),
		recursive: true,
	};
}
