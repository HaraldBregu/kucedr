import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';
import { registry } from '../tools/core/process';

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
	if (toolName === 'bash')
		return typeof args.command === 'string' && args.command.length > 0 ? [args.command] : [];
	if (toolName === 'process') {
		const session = typeof args.sessionId === 'string' ? registry.get(args.sessionId) : undefined;
		return session?.executionMode === 'host' ? [JSON.stringify(args)] : [];
	}
	if (typeof args.path === 'string' && args.path.length > 0) {
		const target = realPath(resolveUserPath(args.path, baseDir));
		return [target];
	}
	return [];
}
