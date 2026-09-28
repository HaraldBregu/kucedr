import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getMcpOauth, saveMcpOauth } from '../mcp';
import type { DriveCreateInput, DriveFile, DriveSyncResult, DriveUpdateInput } from '../../shared/drive_types';

const BASE = 'https://www.googleapis.com';
const FIELDS = 'id,name,mimeType,description,parents,size,modifiedTime,webViewLink,properties,md5Checksum,trashed';
const FOLDER = 'application/vnd.google-apps.folder';

export class DriveClient {
	private async request(path: string, init: RequestInit = {}): Promise<Response> {
		const state = getMcpOauth('google-drive');
		if (!state.tokens?.access_token) throw new Error('Connect Google Drive first.');
		const configuredClientId = process.env.GOOGLE_CLIENT_ID?.trim();
		if (!configuredClientId || state.tokensClientId !== configuredClientId)
			throw new Error('Google Drive credentials changed. Connect again.');
		const send = (token: string): Promise<Response> => fetch(new URL(path, BASE), {
			...init,
			headers: { ...init.headers, Authorization: `Bearer ${token}` },
		});
		let response = await send(state.tokens.access_token);
		if (response.status === 401 && state.tokens.refresh_token) {
			const clientId = configuredClientId;
			const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
			if (!clientId || !clientSecret) throw new Error('Google OAuth client credentials are missing.');
			const refresh = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: state.tokens.refresh_token, grant_type: 'refresh_token' }),
			});
			if (!refresh.ok) throw new Error('Google Drive session expired. Connect again.');
			const tokens = await refresh.json() as { access_token: string; expires_in?: number; token_type?: string };
			saveMcpOauth('google-drive', { ...state, tokens: { ...state.tokens, ...tokens } });
			response = await send(tokens.access_token);
		}
		if (!response.ok) {
			const detail = (await response.text()).slice(0, 500);
			throw new Error(`Google Drive request failed (${response.status}): ${detail}`);
		}
		return response;
	}

	private async file(id: string): Promise<DriveFile> {
		if (!id?.trim()) throw new Error('File ID is required.');
		const params = new URLSearchParams({ fields: FIELDS });
		return this.request(`/drive/v3/files/${encodeURIComponent(id)}?${params}`).then((response) => response.json() as Promise<DriveFile>);
	}

	private async listQuery(q: string): Promise<DriveFile[]> {
		const files: DriveFile[] = [];
		let pageToken: string | undefined;
		do {
			const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FIELDS})`, pageSize: '1000' });
			if (pageToken) params.set('pageToken', pageToken);
			const response = await this.request(`/drive/v3/files?${params}`);
			const page = await response.json() as { files?: DriveFile[]; nextPageToken?: string };
			files.push(...(page.files ?? []));
			pageToken = page.nextPageToken;
		} while (pageToken);
		return files;
	}

	async list(query = '', meetOnly = false): Promise<DriveFile[]> {
		const escaped = query.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
		const clauses = ['trashed = false'];
		if (escaped) clauses.push(`name contains '${escaped}'`);
		if (!meetOnly) return this.listQuery(clauses.join(' and '));
		const folders = await this.listQuery(`trashed = false and mimeType = '${FOLDER}' and name = 'Meet Recordings'`);
		if (folders.length === 0) return [];
		const children = await Promise.all(folders.map((folder) => this.listQuery([...clauses, `'${folder.id}' in parents`].join(' and '))));
		return children.flat();
	}

	async read(id: string): Promise<{ file: DriveFile; content: string }> {
		const file = await this.file(id);
		if (file.mimeType === FOLDER) throw new Error('A folder has no file content.');
		const native = file.mimeType.startsWith('application/vnd.google-apps.');
		const exportType = file.mimeType === 'application/vnd.google-apps.document' ? 'text/plain'
			: file.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'text/csv' : undefined;
		if (native && !exportType) throw new Error('Open this Google file in its native editor or download it.');
		if (!native && !file.mimeType.startsWith('text/') && !['application/json', 'application/xml', 'application/javascript'].includes(file.mimeType))
			throw new Error('Download this file to view its binary content.');
		const path = exportType
			? `/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(exportType)}`
			: `/drive/v3/files/${encodeURIComponent(id)}?alt=media`;
		const content = await (await this.request(path)).text();
		return { file, content };
	}

	private async upload(input: DriveCreateInput, bytes: Buffer): Promise<DriveFile> {
		const metadata = { name: input.name, mimeType: input.mimeType ?? 'application/octet-stream', description: input.description, parents: input.parentId ? [input.parentId] : undefined };
		const boundary = `kucedr-${createHash('sha256').update(input.name).digest('hex').slice(0, 20)}`;
		const body = Buffer.concat([
			Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`),
			bytes,
			Buffer.from(`\r\n--${boundary}--`),
		]);
		const response = await this.request(`/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(FIELDS)}`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
		return response.json() as Promise<DriveFile>;
	}

	async create(input: DriveCreateInput): Promise<DriveFile> {
		if (!input?.name?.trim()) throw new Error('File name is required.');
		if (input.mimeType === FOLDER) {
			const response = await this.request(`/drive/v3/files?fields=${encodeURIComponent(FIELDS)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.name, mimeType: FOLDER, parents: input.parentId ? [input.parentId] : undefined }) });
			return response.json() as Promise<DriveFile>;
		}
		return this.upload({ ...input, mimeType: input.mimeType ?? 'text/plain' }, Buffer.from(input.content ?? '', 'utf8'));
	}

	async update(id: string, input: DriveUpdateInput): Promise<DriveFile> {
		const current = await this.file(id);
		const params = new URLSearchParams({ fields: FIELDS });
		if (input.parentId && input.parentId !== current.parents?.[0]) {
			params.set('addParents', input.parentId);
			if (current.parents?.[0]) params.set('removeParents', current.parents[0]);
		}
		const metadata = { name: input.name, description: input.description, properties: input.properties };
		if (Object.values(metadata).some((value) => value !== undefined) || input.parentId) {
			await this.request(`/drive/v3/files/${encodeURIComponent(id)}?${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });
		}
		if (input.content !== undefined) {
			if (current.mimeType.startsWith('application/vnd.google-apps.')) throw new Error('Edit Google Docs content in its native editor.');
			await this.request(`/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=${encodeURIComponent(FIELDS)}`, { method: 'PATCH', headers: { 'Content-Type': current.mimeType }, body: input.content });
		}
		return this.file(id);
	}

	async trash(id: string): Promise<void> {
		await this.request(`/drive/v3/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
	}

	async downloadInfo(id: string): Promise<{ file: DriveFile; name: string }> {
		const file = await this.file(id);
		if (file.mimeType === FOLDER) throw new Error('A folder cannot be downloaded as a file.');
		const native = file.mimeType.startsWith('application/vnd.google-apps.');
		return { file, name: native ? `${file.name}.pdf` : file.name };
	}

	async download(id: string, destination: string, file: DriveFile): Promise<void> {
		const native = file.mimeType.startsWith('application/vnd.google-apps.');
		const path = native
			? `/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=application%2Fpdf`
			: `/drive/v3/files/${encodeURIComponent(id)}?alt=media`;
		const response = await this.request(path);
		if (!response.body) throw new Error('Google Drive returned no file content.');
		await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destination));
	}

	async sync(folderPath: string): Promise<DriveSyncResult> {
		const result = { uploaded: 0, skipped: 0, failed: 0 };
		const root = await this.findOrCreateFolder('Kucedr Backup', 'root');
		const destination = await this.findOrCreateFolder(basename(folderPath), root.id);
		const visit = async (local: string, parentId: string): Promise<void> => {
			for (const entry of await readdir(local, { withFileTypes: true })) {
				if (entry.isSymbolicLink()) continue;
				const path = join(local, entry.name);
				try {
					if (entry.isDirectory()) {
						const folder = await this.findOrCreateFolder(entry.name, parentId);
						await visit(path, folder.id);
					} else if (entry.isFile()) {
						const bytes = await readFile(path);
						const hash = createHash('md5').update(bytes).digest('hex');
						const existing = (await this.listQuery(`trashed = false and '${parentId}' in parents and name = '${entry.name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`))[0];
						if (existing?.md5Checksum === hash) { result.skipped++; continue; }
						const mimeType = /\.(txt|md|csv|tsv|html|css|js|ts|tsx|jsx)$/i.test(entry.name) ? 'text/plain'
							: /\.json$/i.test(entry.name) ? 'application/json' : 'application/octet-stream';
						if (existing) await this.request(`/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mimeType }, body: bytes });
						else await this.upload({ name: entry.name, parentId, mimeType }, bytes);
						result.uploaded++;
					}
				} catch { result.failed++; }
			}
		};
		await visit(folderPath, destination.id);
		return result;
	}

	private async findOrCreateFolder(name: string, parentId?: string): Promise<DriveFile> {
		const escaped = name.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
		const q = [`trashed = false`, `mimeType = '${FOLDER}'`, `name = '${escaped}'`, ...(parentId ? [`'${parentId}' in parents`] : [])].join(' and ');
		return (await this.listQuery(q))[0] ?? this.create({ name, mimeType: FOLDER, parentId });
	}
}
