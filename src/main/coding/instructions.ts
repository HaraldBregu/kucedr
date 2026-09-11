import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadProjectContextFiles } from '@earendil-works/pi-coding-agent';
import type {
	CodingProject,
	CodingProjectInstructions,
	CodingProjectInstructionsUpdate,
} from '../../shared/coding_types';
import { atomicWrite } from '../shared/atomic_write';
import { codingLocation } from './location';

const DEFAULT_FILE_NAME = 'AGENTS.md';
const MAX_FILE_SIZE = 256 * 1024;

export class CodingInstructions {
	constructor(private readonly agentDirectory = codingLocation()) {}

	async get(project: CodingProject): Promise<CodingProjectInstructions> {
		const workspaceDirectory = path.resolve(project.directory);
		const agentDirectory = path.resolve(this.agentDirectory);
		const contextFiles = loadProjectContextFiles({
			cwd: workspaceDirectory,
			agentDir: agentDirectory,
		});
		const workspaceSource = contextFiles.find(
			(source) => path.dirname(path.resolve(source.path)) === workspaceDirectory
		);
		const activeFilePath = workspaceSource
			? path.resolve(workspaceSource.path)
			: path.join(workspaceDirectory, DEFAULT_FILE_NAME);
		let content = '';
		let exists = false;
		let editable = true;

		try {
			const status = await lstat(activeFilePath);
			if (status.isSymbolicLink()) editable = false;
			else if (!status.isFile()) {
				throw new Error('Coding project instructions must be a regular file.');
			}
			content = await readFile(activeFilePath, 'utf8');
			exists = true;
		} catch (error) {
			if (
				!error ||
				typeof error !== 'object' ||
				(error as NodeJS.ErrnoException).code !== 'ENOENT'
			) {
				throw error;
			}
		}

		if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
			throw new Error('Coding project instructions exceed the 256 KiB limit.');
		}

		return {
			projectId: project.id,
			activeFilePath,
			activeFileName: path.basename(activeFilePath),
			content,
			exists,
			editable,
			revision: createHash('sha256')
				.update(exists ? 'file' : 'missing')
				.update('\0')
				.update(activeFilePath)
				.update('\0')
				.update(content)
				.digest('hex'),
			loadedSources: contextFiles.map((source) => {
				const sourcePath = path.resolve(source.path);
				const sourceDirectory = path.dirname(sourcePath);
				return {
					path: sourcePath,
					scope:
						sourceDirectory === workspaceDirectory
							? 'workspace'
							: sourceDirectory === agentDirectory
								? 'coding-global'
								: 'ancestor',
				};
			}),
		};
	}

	async save(
		project: CodingProject,
		update: CodingProjectInstructionsUpdate
	): Promise<CodingProjectInstructions> {
		if (Buffer.byteLength(update.content, 'utf8') > MAX_FILE_SIZE) {
			throw new Error('Coding project instructions exceed the 256 KiB limit.');
		}
		const current = await this.get(project);
		if (current.revision !== update.expectedRevision) {
			throw new Error('Coding project instructions changed outside Kucedr. Reload before saving.');
		}
		if (!current.editable) {
			throw new Error('Coding project instructions cannot be edited through a symbolic link.');
		}
		await atomicWrite(current.activeFilePath, update.content);
		return this.get(project);
	}
}
