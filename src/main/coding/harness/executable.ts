import { app } from 'electron';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export function codexExecutable(): string {
	const architecture = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
	const target = { darwin: 'apple-darwin', linux: 'unknown-linux-musl', win32: 'pc-windows-msvc' }[
		process.platform
	];
	if (!architecture || !target)
		throw new Error(`Codex does not support ${process.platform}/${process.arch}.`);
	const resolve = createRequire(join(app.getAppPath(), 'package.json')).resolve;
	const packageName = `@openai/codex-${process.platform}-${process.arch}`;
	let root: string;
	try {
		root = dirname(resolve(`${packageName}/package.json`));
	} catch {
		root = dirname(resolve('@openai/codex/package.json'));
	}
	const executable = join(
		root,
		'vendor',
		`${architecture}-${target}`,
		'bin',
		process.platform === 'win32' ? 'codex.exe' : 'codex'
	).replace(/app\.asar([/\\])/, 'app.asar.unpacked$1');
	if (!existsSync(executable))
		throw new Error('The Codex executable is missing. Reinstall the application.');
	return executable;
}
