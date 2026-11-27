import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';

// Whether two files or folders hold the same names and bytes; a missing one equals only another
// missing one.
export function same(a: string, b: string): boolean {
	if (!existsSync(a) || !existsSync(b)) return !existsSync(a) && !existsSync(b);
	const left = lstatSync(a);
	const right = lstatSync(b);
	if (left.isSymbolicLink() || right.isSymbolicLink())
		return left.isSymbolicLink() && right.isSymbolicLink() && readlinkSync(a) === readlinkSync(b);
	if (left.isDirectory() !== right.isDirectory()) return false;
	if (!left.isDirectory()) return left.size === right.size && readFileSync(a).equals(readFileSync(b));
	const names = readdirSync(a).sort();
	const others = readdirSync(b).sort();
	return (
		names.length === others.length &&
		names.every((name, index) => name === others[index] && same(path.join(a, name), path.join(b, name)))
	);
}
