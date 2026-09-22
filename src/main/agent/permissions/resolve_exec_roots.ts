import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';

export function resolveExecRoots(args: Record<string, unknown>, baseDir: string): string[] {
	if (typeof args.command !== 'string' || args.command.length === 0) return [];
	const workdir = realPath(
		resolveUserPath(
			typeof args.workdir === 'string' && args.workdir.length > 0 ? args.workdir : '.',
			baseDir
		)
	);
	const additionalRoots = Array.isArray(args.additionalRoots)
		? args.additionalRoots.filter((value): value is string => typeof value === 'string' && value.length > 0)
		: [];
	return [...new Set([workdir, ...additionalRoots.map((root) => realPath(resolveUserPath(root, workdir)))])];
}
