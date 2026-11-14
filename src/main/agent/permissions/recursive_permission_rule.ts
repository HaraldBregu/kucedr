import path from 'node:path';

export function recursivePermissionRule(target: string): string {
	const resolved = path.resolve(target);
	if (/[*?[\]{}]/.test(resolved)) throw new Error('Permission rules require a literal path.');
	return resolved === path.parse(resolved).root
		? `${resolved}**`
		: `${resolved}${path.sep}**`;
}
