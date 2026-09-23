import type { SupabaseClient } from '@supabase/supabase-js';

export interface UploadRequest {
	providerId: string;
	workspaceId: string;
	operationId: string;
	versionId: string;
	sha256: string;
	sizeBytes: number;
}

export interface UploadGrant {
	bucket: string;
	key: string;
	uploadUrl: string;
	headers: Record<string, string>;
}

export interface PublishRequest extends Omit<UploadRequest, 'providerId' | 'sha256' | 'sizeBytes'> {
	fileId: string;
	kind: 'content' | 'tombstone' | 'rename' | 'restore';
	path: string | null;
	parentIds: string[];
	deviceId: string;
	sha256?: string;
	sizeBytes?: number;
	bucket?: string;
	key?: string;
}

export interface Publication {
	sequence: number;
	heads: string[];
}

export interface StorageChange {
	workspace_id: string;
	sequence: string;
	file_id: string;
	version_id: string;
}

export interface StorageVersion {
	id: string;
	file_id: string;
	workspace_id: string;
	kind: PublishRequest['kind'];
	path: string | null;
	bucket: string | null;
	sha256: string | null;
	size_bytes: number | null;
	object_key: string | null;
}

export class StorageCloudApi {
	constructor(private readonly client: SupabaseClient) {}

	async reserveUpload(request: UploadRequest): Promise<UploadGrant> {
		return this.invoke('storage-upload', request);
	}

	async publish(request: PublishRequest): Promise<Publication> {
		return this.invoke('storage-publish', request);
	}

	async changes(workspaceId: string, after: string): Promise<StorageChange[]> {
		const { data, error } = await this.client.rpc('storage_changes_since', {
			p_workspace_id: workspaceId, p_after: after,
		});
		if (error) throw new Error(`Storage change discovery failed: ${error.message}.`);
		return data ?? [];
	}

	async version(workspaceId: string, versionId: string): Promise<StorageVersion> {
		const { data, error } = await this.client.from('storage_versions')
			.select('id,file_id,workspace_id,kind,path,bucket,sha256,size_bytes,object_key')
			.eq('workspace_id', workspaceId).eq('id', versionId).single();
		if (error || !data) throw new Error(`Storage version lookup failed: ${error?.message ?? 'missing version'}.`);
		return data as StorageVersion;
	}

	async parents(workspaceId: string, versionId: string): Promise<string[]> {
		const { data, error } = await this.client.from('storage_version_parents')
			.select('parent_id').eq('workspace_id', workspaceId).eq('version_id', versionId);
		if (error) throw new Error(`Storage ancestry lookup failed: ${error.message}.`);
		return (data ?? []).map((row) => row.parent_id);
	}

	async heads(workspaceId: string, fileId: string): Promise<string[]> {
		const { data, error } = await this.client.from('storage_heads')
			.select('version_id').eq('workspace_id', workspaceId).eq('file_id', fileId);
		if (error) throw new Error(`Storage head lookup failed: ${error.message}.`);
		return (data ?? []).map((row) => row.version_id);
	}

	async download(workspaceId: string, versionId: string): Promise<Uint8Array> {
		const grant = await this.invoke<{ url: string }>('storage-download', { workspaceId, versionId });
		const response = await fetch(grant.url);
		if (!response.ok) throw new Error(`Storage download failed (${response.status}).`);
		return new Uint8Array(await response.arrayBuffer());
	}

	async upload(grant: UploadGrant, content: Uint8Array): Promise<void> {
		const response = await fetch(grant.uploadUrl, {
			method: 'PUT',
			headers: grant.headers,
			body: Buffer.from(content),
		});
		if (!response.ok && response.status !== 412) {
			throw new Error(`Storage upload failed (${response.status}).`);
		}
	}

	private async invoke<T>(name: string, body: unknown): Promise<T> {
		const { data, error } = await this.client.functions.invoke<T>(name, {
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' },
		});
		if (error || !data) throw new Error(`Storage ${name} failed: ${error?.message ?? 'empty response'}.`);
		return data;
	}
}
