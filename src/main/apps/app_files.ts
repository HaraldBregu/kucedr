import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAppId } from './app_id';

export class AppFileStorage {
	constructor(private readonly root: string) {}

	async read(appId: string, filePath: string): Promise<Uint8Array> {
		const target = await this.existingFile(appId, filePath);
		if (!target) throw new Error('App file not found.');
		return new Uint8Array(await fs.readFile(target));
	}

	async write(appId: string, filePath: string, data: Uint8Array): Promise<void> {
		if (!(data instanceof Uint8Array)) throw new Error('App file data must be bytes.');
		const target = await this.writableFile(appId, filePath);
		const temporary = path.join(
			path.dirname(target),
			`.${path.basename(target)}.${randomUUID()}.tmp`
		);
		try {
			await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
			await fs.rename(temporary, target);
		} finally {
			await fs.rm(temporary, { force: true });
		}
	}

	async delete(appId: string, filePath: string): Promise<void> {
		const target = await this.existingFile(appId, filePath);
		if (target) await fs.unlink(target);
	}

	private namespace(appId: string): string {
		if (!isAppId(appId)) throw new Error('Invalid app ID.');
		return path.join(this.root, appId, 'data');
	}

	private fileSegments(filePath: string): string[] {
		if (
			typeof filePath !== 'string' ||
			filePath.length === 0 ||
			filePath.includes('\\') ||
			filePath.includes('\0') ||
			path.isAbsolute(filePath) ||
			path.posix.isAbsolute(filePath) ||
			path.win32.isAbsolute(filePath)
		) {
			throw new Error('Invalid app file path.');
		}
		const segments = filePath.split('/');
		if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
			throw new Error('Invalid app file path.');
		}
		return segments;
	}

	private async existingFile(appId: string, filePath: string): Promise<string | undefined> {
		const segments = this.fileSegments(filePath);
		const namespace = this.namespace(appId);
		const filesRoot = path.join(namespace, 'files');
		let current = this.root;
		for (const segment of [appId, 'data', 'files', ...segments.slice(0, -1)]) {
			if (!(await this.isExistingDirectory(current))) return undefined;
			current = path.join(current, segment);
		}
		if (!(await this.isExistingDirectory(current))) return undefined;

		const target = path.join(filesRoot, ...segments);
		let stats;
		try {
			stats = await fs.lstat(target);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
			throw error;
		}
		if (stats.isSymbolicLink() || !stats.isFile()) {
			throw new Error('App file path is not a regular file.');
		}
		await this.assertContained(filesRoot, target);
		return target;
	}

	private async writableFile(appId: string, filePath: string): Promise<string> {
		const segments = this.fileSegments(filePath);
		const namespace = this.namespace(appId);
		const filesRoot = path.join(namespace, 'files');
		const appDirectory = path.join(this.root, appId);
		await fs.mkdir(this.root, { recursive: true });
		await this.requireDirectory(this.root);
		await this.createDirectory(appDirectory);
		await this.createDirectory(namespace);
		await this.createDirectory(filesRoot);

		let parent = filesRoot;
		for (const segment of segments.slice(0, -1)) {
			parent = path.join(parent, segment);
			await this.createDirectory(parent);
		}

		const target = path.join(filesRoot, ...segments);
		try {
			const stats = await fs.lstat(target);
			if (stats.isSymbolicLink() || !stats.isFile()) {
				throw new Error('App file path is not a regular file.');
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		await this.assertContained(filesRoot, parent);
		return target;
	}

	private async createDirectory(directory: string): Promise<void> {
		try {
			await fs.mkdir(directory);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
		await this.requireDirectory(directory);
	}

	private async isExistingDirectory(directory: string): Promise<boolean> {
		try {
			await this.requireDirectory(directory);
			return true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
			throw error;
		}
	}

	private async requireDirectory(directory: string): Promise<void> {
		const stats = await fs.lstat(directory);
		if (stats.isSymbolicLink() || !stats.isDirectory()) {
			throw new Error('Invalid app storage directory.');
		}
	}

	private async assertContained(root: string, target: string): Promise<void> {
		const [resolvedRoot, resolvedTarget] = await Promise.all([
			fs.realpath(root),
			fs.realpath(target),
		]);
		const relative = path.relative(resolvedRoot, resolvedTarget);
		if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
			throw new Error('App file path escapes its storage folder.');
		}
	}
}
