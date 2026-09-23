import type { SupabaseClient } from '@supabase/supabase-js';

export interface UploadRequest {
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

export interface PublishRequest extends UploadRequest {
	fileId: string;
	kind: 'content' | 'tombstone' | 'rename' | 'restore';
	path: string;
	parentIds: string[];
	deviceId: string;
	bucket?: string;
	key?: string;
}

export interface Publication {
	sequence: number;
	heads: string[];
}

export class StorageCloudApi {
	constructor(private readonly client: SupabaseClient) {}

	async reserveUpload(request: UploadRequest): Promise<UploadGrant> {
		return this.invoke('storage-upload', request);
	}

	async publish(request: PublishRequest): Promise<Publication> {
		return this.invoke('storage-publish', request);
	}

	async upload(grant: UploadGrant, content: Uint8Array): Promise<void> {
		const response = await fetch(grant.uploadUrl, {
			method: 'PUT',
			headers: grant.headers,
			body: Buffer.from(content),
		});
		if (!response.ok) throw new Error(`Storage upload failed (${response.status}).`);
	}

	private async invoke<T>(name: string, body: unknown): Promise<T> {
		const { data, error } = await this.client.functions.invoke<T>(name, { body });
		if (error || !data) throw new Error(`Storage ${name} failed: ${error?.message ?? 'empty response'}.`);
		return data;
	}
}
