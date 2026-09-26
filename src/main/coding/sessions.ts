import { randomUUID } from 'node:crypto';
import {
	mkdirSync,
	existsSync,
	readFileSync,
	writeFileSync,
	renameSync,
	readdirSync,
	unlinkSync,
	appendFileSync,
} from 'node:fs';
import path from 'node:path';
import type {
	CodingSessionSummary,
	CodingSettings,
	CodingSessionSnapshot,
} from '../../shared/coding_types';
import { codingSessionsLocation } from './location';
import { transcript, type JournalEvent } from './transcript';

export interface CoderSession extends CodingSessionSummary {
	readonly runtime: CodingSettings['runtime'];
	readonly workingDirectory: string;
	readonly settings: CodingSettings;
	readonly nativeSessionId?: string;
}

export class CoderSessions {
	constructor(private readonly directory = path.join(codingSessionsLocation(), 'records')) {
		mkdirSync(directory, { recursive: true });
	}
	list(projectId: string): CoderSession[] {
		return readdirSync(this.directory)
			.filter((name) => name.endsWith('.json'))
			.map((name) => this.read(name.slice(0, -5)))
			.filter((s): s is CoderSession => Boolean(s && s.projectId === projectId))
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}
	read(id: string): CoderSession | undefined {
		const file = this.file(id, '.json');
		if (!existsSync(file)) return undefined;
		return JSON.parse(readFileSync(file, 'utf8')) as CoderSession;
	}
	create(
		projectId: string,
		cwd: string,
		settings: CodingSettings,
		input: string,
		id = randomUUID(),
		nativeSessionId?: string
	): CoderSession {
		const timestamp = new Date().toISOString();
		const session: CoderSession = {
			id,
			projectId,
			title: input.slice(0, 80) || 'New session',
			runtime: settings.runtime,
			workingDirectory: cwd,
			settings: { ...settings, workingDirectory: cwd },
			nativeSessionId,
			createdAt: timestamp,
			updatedAt: timestamp,
			messageCount: 0,
		};
		this.save(session);
		return session;
	}
	save(session: CoderSession): void {
		const file = this.file(session.id, '.json');
		writeFileSync(file + '.tmp', JSON.stringify(session), { mode: 0o600 });
		renameSync(file + '.tmp', file);
	}
	append(id: string, event: JournalEvent['event']): void {
		appendFileSync(
			this.file(id, '.jsonl'),
			JSON.stringify({ event, timestamp: new Date().toISOString() }) + '\n',
			{ mode: 0o600 }
		);
	}
	snapshot(session: CoderSession): CodingSessionSnapshot {
		const file = this.file(session.id, '.jsonl');
		const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [];
		const entries: JournalEvent[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (!lines[i]) continue;
			try {
				entries.push(JSON.parse(lines[i]) as JournalEvent);
			} catch (error) {
				if (i < lines.length - 1) throw error;
			}
		}
		const blocks = transcript(entries);
		return {
			session: { ...session, messageCount: blocks.filter((b) => b.type === 'message').length },
			blocks,
		};
	}
	delete(id: string): boolean {
		if (!this.read(id)) return false;
		for (const extension of ['.json', '.jsonl']) {
			const file = this.file(id, extension);
			if (existsSync(file)) unlinkSync(file);
		}
		return true;
	}
	private file(id: string, extension: string): string {
		if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('Invalid Coder session id.');
		return path.join(this.directory, id + extension);
	}
}
