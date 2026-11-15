import { protectedRoots } from './protected';
import { samePathOrWithin } from './same_path_or_within';
import type { PermissionKind } from './permissions_types';

export function isProtectedTarget(target: string, kind: PermissionKind): boolean {
	const roots = protectedRoots();
	if (kind === 'read') return roots.read.some((root) => samePathOrWithin(target, root));
	return roots.write.some(
		(root) =>
			samePathOrWithin(target, root) &&
			!roots.writable.some(
				(directory) => samePathOrWithin(directory, root) && samePathOrWithin(target, directory)
			)
	);
}
