import fs from 'node:fs';
import path from 'node:path';

function realPath(target) {
	let existing = path.resolve(target);
	const missing = [];
	while (!fs.existsSync(existing)) {
		const parent = path.dirname(existing);
		if (parent === existing) return path.resolve(target);
		missing.unshift(path.basename(existing));
		existing = parent;
	}
	return path.resolve(fs.realpathSync(existing), ...missing);
}

export function isProtected(value, protectedRoot) {
	const resolved = realPath(value);
	const root = realPath(protectedRoot);
	return ['settings', 'providers', 'storage']
		.map((name) => path.join(root, name))
		.some((folder) => resolved === folder || resolved.startsWith(`${folder}${path.sep}`));
}
