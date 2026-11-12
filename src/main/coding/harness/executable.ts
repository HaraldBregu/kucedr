import { app } from 'electron';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { ModelHarness } from '../../../shared/model_types';

export function harnessExecutable(
	harness: Pick<ModelHarness, 'package' | 'binary'>,
	name: string
): string {
	const architecture = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
	const target = { darwin: 'apple-darwin', linux: 'unknown-linux-musl', win32: 'pc-windows-msvc' }[
		process.platform
	];
	if (!architecture || !target)
		throw new Error(`${name} does not support ${process.platform}/${process.arch}.`);
	const resolve = createRequire(join(app.getAppPath(), 'package.json')).resolve;
	const packageName = `${harness.package}-${process.platform}-${process.arch}`;
	let root: string;
	try {
		root = dirname(resolve(`${packageName}/package.json`));
	} catch {
		root = dirname(resolve(`${harness.package}/package.json`));
	}
	const executable = join(
		root,
		'vendor',
		`${architecture}-${target}`,
		'bin',
		process.platform === 'win32' ? `${harness.binary}.exe` : harness.binary
	).replace(/app\.asar([/\\])/, 'app.asar.unpacked$1');
	if (!existsSync(executable))
		throw new Error(`The ${name} executable is missing. Reinstall the application.`);
	return executable;
}
