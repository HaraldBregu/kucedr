import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import type { CodingProject } from '../../shared/coding_types';
import { agentLocation } from '../shared/agent_location';

interface StoredCodingProject extends Omit<CodingProject, 'available'> {}

export class CodingProjectStore {
	private readonly store: Store<{ projects: StoredCodingProject[] }>;
	private readonly workspaceDirectory: string;
	private readonly projectsDirectory: string;

	constructor(
		initialDirectories: readonly string[] = [agentLocation()],
		directory = path.join(userDataLocation(), 'coder')
	) {
		this.store = new Store<{ projects: StoredCodingProject[] }>({
			name: 'projects',
			cwd: directory,
			accessPropertiesByDotNotation: false,
			defaults: { projects: [] },
		});
		this.projectsDirectory = path.join(directory, 'workspaces');
		mkdirSync(this.projectsDirectory, { recursive: true });
		this.workspaceDirectory = path.resolve(agentLocation());
		for (const initialDirectory of initialDirectories) this.seed(initialDirectory);
	}

	private get projects(): StoredCodingProject[] {
		const projects = new Map(this.store.get('projects').map((project) => [project.id, project]));
		for (const entry of readdirSync(this.projectsDirectory, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const file = path.join(this.projectsDirectory, entry.name, 'config.json');
			if (!existsSync(file)) continue;
			const project = JSON.parse(readFileSync(file, 'utf8')) as StoredCodingProject;
			if (project.id === entry.name) projects.set(project.id, project);
		}
		return [...projects.values()];
	}

	private save(project: StoredCodingProject): void {
		const directory = path.join(this.projectsDirectory, project.id);
		mkdirSync(path.join(directory, 'sessions'), { recursive: true });
		const file = path.join(directory, 'config.json');
		writeFileSync(file + '.tmp', JSON.stringify(project, null, 2), { mode: 0o600 });
		renameSync(file + '.tmp', file);
	}

	list(): CodingProject[] {
		return [...this.projects]
			.sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
			.map((project) => ({ ...project, available: this.isAvailable(project.directory) }));
	}

	get(projectId: string): CodingProject | undefined {
		return this.list().find((project) => project.id === projectId);
	}

	add(directory: string): CodingProject {
		const canonicalDirectory = this.canonicalDirectory(directory);
		const existing = this.projects.find(
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
		this.save(project);
		return { ...project, available: true };
	}

	remove(projectId: string): boolean {
		const projects = this.projects.filter((project) => project.id !== projectId);
		if (projects.length === this.projects.length) return false;
		this.store.set('projects', this.store.get('projects').filter((project) => project.id !== projectId));
		const file = path.join(this.projectsDirectory, projectId, 'config.json');
		if (existsSync(file)) unlinkSync(file);
		return true;
	}

	touch(projectId: string): void {
		const timestamp = new Date().toISOString();
		const project = this.projects.find((project) => project.id === projectId);
		if (project) this.save({ ...project, lastOpenedAt: timestamp });
	}

	private seed(directory: string): void {
		try {
			const canonicalDirectory = this.canonicalDirectory(directory);
			if (this.projects.some((project) => project.directory === canonicalDirectory)) {
				return;
			}
			this.add(canonicalDirectory);
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
