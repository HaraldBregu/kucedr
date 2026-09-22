import path from 'node:path';

export function recursivePermissionRule(target: string): string {
	const resolved = path.resolve(target);
	return resolved === path.parse(resolved).root
		? `${resolved}**`
		: `${resolved}${path.sep}**`;
}
