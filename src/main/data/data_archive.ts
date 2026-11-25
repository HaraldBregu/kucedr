import fs from 'node:fs/promises';
import path from 'node:path';
import { unseal } from '../vault/unseal';

export interface DataArchiveFile {
	path: string;
	bytes: number;
	encoding: 'base64';
	data: string;
}

export class DataArchive {
	private readonly entries: DataArchiveFile[] = [];

	async addFile(filePath: string, archivePath: string): Promise<void> {
		let stats;
		try {
			stats = await fs.lstat(filePath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
		if (stats.isSymbolicLink()) throw new Error(`Refusing to export symlink: ${archivePath}`);
		if (!stats.isFile()) return;
		const bytes = unseal(await fs.readFile(filePath));
		this.entries.push({
			path: archivePath.split(path.sep).join('/'),
			bytes: bytes.byteLength,
			encoding: 'base64',
			data: bytes.toString('base64'),
		});
	}

	async addTree(root: string, prefix: string): Promise<void> {
		let entries;
		try {
			entries = await fs.readdir(root, { withFileTypes: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
		for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
			const filePath = path.join(root, entry.name);
			const archivePath = path.join(prefix, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Refusing to export symlink: ${archivePath}`);
			if (entry.isDirectory()) await this.addTree(filePath, archivePath);
			else if (entry.isFile()) await this.addFile(filePath, archivePath);
		}
	}

	addJson(archivePath: string, value: unknown): void {
		const data = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
		this.entries.push({
			path: archivePath,
			bytes: data.byteLength,
			encoding: 'base64',
			data: data.toString('base64'),
		});
	}

	files(): DataArchiveFile[] {
		return this.entries.map((entry) => ({ ...entry }));
	}

	bytes(): number {
		return this.entries.reduce((total, entry) => total + entry.bytes, 0);
	}
}
