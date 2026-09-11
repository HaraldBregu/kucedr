import { existsSync, realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import Store from 'electron-store';
import type { CodingProject } from '../../shared/coding_types';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';

interface StoredCodingProject extends Omit<CodingProject, 'available'> {}

interface CodingProjectState {
	projects: StoredCodingProject[];
}

export class CodingProjectStore {
	private readonly store: Store<CodingProjectState>;
	private readonly workspaceDirectory: string;

	constructor(
		directory = path.resolve(userDataLocation(), 'settings'),
		initialDirectories: readonly string[] = [agentLocation()]
	) {
		this.workspaceDirectory = path.resolve(agentLocation());
		this.store = new Store<CodingProjectState>({
			name: 'coding-projects',
			cwd: directory,
			accessPropertiesByDotNotation: false,
			defaults: { projects: [] },
		});
		for (const initialDirectory of initialDirectories) this.seed(initialDirectory);
	}

	list(): CodingProject[] {
		return [...this.store.store.projects]
			.sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
			.map((project) => ({ ...project, available: this.isAvailable(project.directory) }));
	}

	get(projectId: string): CodingProject | undefined {
		return this.list().find((project) => project.id === projectId);
	}

	add(directory: string): CodingProject {
		const canonicalDirectory = this.canonicalDirectory(directory);
		const existing = this.store.store.projects.find(
			(project) => project.directory === canonicalDirectory
		);
		if (existing) {
			this.touch(existing.id);
			return this.get(existing.id) as CodingProject;
		}
		const timestamp = new Date().toISOString();
		const project: StoredCodingProject = {
			id: randomUUID(),
			name: path.basename(canonicalDirectory) || canonicalDirectory,
			directory: canonicalDirectory,
			kind: this.projectKind(canonicalDirectory),
			createdAt: timestamp,
			lastOpenedAt: timestamp,
		};
		this.store.store = { projects: [project, ...this.store.store.projects] };
		return { ...project, available: true };
	}

	remove(projectId: string): boolean {
		const projects = this.store.store.projects.filter((project) => project.id !== projectId);
		if (projects.length === this.store.store.projects.length) return false;
		this.store.store = { projects };
		return true;
	}

	touch(projectId: string): void {
		const timestamp = new Date().toISOString();
		this.store.store = {
			projects: this.store.store.projects.map((project) =>
				project.id === projectId ? { ...project, lastOpenedAt: timestamp } : project
			),
		};
	}

	private seed(directory: string): void {
		try {
			const canonicalDirectory = this.canonicalDirectory(directory);
			if (this.store.store.projects.some((project) => project.directory === canonicalDirectory)) {
				return;
			}
			const timestamp = new Date().toISOString();
			this.store.store = {
				projects: [
					...this.store.store.projects,
					{
						id: randomUUID(),
						name: path.basename(canonicalDirectory) || canonicalDirectory,
						directory: canonicalDirectory,
						kind: this.projectKind(canonicalDirectory),
						createdAt: timestamp,
						lastOpenedAt: timestamp,
					},
				],
			};
		} catch {
			return;
		}
	}

	private canonicalDirectory(directory: string): string {
		if (!path.isAbsolute(directory)) throw new Error('Coding project directory must be absolute.');
		const absoluteDirectory = path.resolve(directory);
		if (!existsSync(absoluteDirectory) || !statSync(absoluteDirectory).isDirectory()) {
			throw new Error('Coding project directory is unavailable.');
		}
		return realpathSync.native(absoluteDirectory);
	}

	private projectKind(directory: string): CodingProject['kind'] {
		const relative = path.relative(this.workspaceDirectory, directory);
		return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..')
			? 'agent-workspace'
			: 'external';
	}

	private isAvailable(directory: string): boolean {
		try {
			return existsSync(directory) && statSync(directory).isDirectory();
		} catch {
			return false;
		}
	}
}
