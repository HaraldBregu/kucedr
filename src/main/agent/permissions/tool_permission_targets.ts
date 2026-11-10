import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';
import { parsePatch } from '../tools/core/patch/parse';

export function toolPermissionTargets(
	toolName: string,
	args: Record<string, unknown>,
	baseDir: string
): string[] {
	if (toolName === 'patch')
		return typeof args.input === 'string'
			? parsePatch(args.input).flatMap((hunk) =>
				[hunk.path, ...(hunk.kind === 'update' && hunk.movePath ? [hunk.movePath] : [])]
					.map((target) => realPath(resolveUserPath(target, baseDir)))
			)
			: [];
	if (typeof args.path === 'string' && args.path.length > 0) {
		const target = realPath(resolveUserPath(args.path, baseDir));
		return [target];
	}
	return [];
}
