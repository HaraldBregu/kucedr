import { realPath } from '../../shared/real_path';
import { isPathWithin } from './permissions_path';
import { protectedRoots } from './protected';
import type { PermissionKind } from './permissions_types';

export function isProtectedTarget(target: string, kind: PermissionKind): boolean {
	const fold = (value: string): string =>
		process.platform === 'darwin' || process.platform === 'win32' ? value.toLowerCase() : value;
	const roots = protectedRoots();
	const resolved = fold(realPath(target));
	const writable = roots.writable.map(fold);
	if (kind === 'read') return roots.read.some((root) => isPathWithin(fold(root), resolved));
	return roots.write.map(fold).some(
		(root) =>
			isPathWithin(root, resolved) &&
			!writable.some((directory) => isPathWithin(root, directory) && isPathWithin(directory, resolved))
	);
}
