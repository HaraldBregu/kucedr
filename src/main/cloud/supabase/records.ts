import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type {
	CloudChange,
	CloudChatMessage,
	CloudChatMessageInput,
	CloudChatSession,
	CloudChatSessionInput,
	CloudFile,
	CloudFileUpload,
	CloudJson,
} from '../../../shared/cloud_types';
import type { CloudRepository } from '../repository';
import { publicCloudError } from '../cloud_error';

interface SessionRow {
	id: string;
	title: string;
	model: string | null;
	created_at: string;
	updated_at: string;
}

interface MessageRow {
	id: string;
	session_id: string;
	ordinal: number;
	role: 'system' | 'user' | 'assistant';
	content: CloudJson;
	tool_calls: CloudJson[];
	usage: CloudJson | null;
	created_at: string;
}

interface FileRow {
	id: string;
	session_id: string;
	file_name: string;
	mime_type: string;
	size_bytes: number;
	created_at: string;
}

export class SupabaseCloudRepository implements CloudRepository {
	private readonly channels = new Map<string, RealtimeChannel>();

	constructor(private readonly client: SupabaseClient) {}

	setAccessToken(accessToken: string | null): Promise<void> {
		return this.client.realtime.setAuth(accessToken);
	}

	async listSessions(): Promise<CloudChatSession[]> {
		const { data, error } = await this.client
			.from('chat_sessions')
			.select('id,title,model,created_at,updated_at')
			.order('updated_at', { ascending: false });
		if (error) throw publicCloudError(error);
		return (data as SessionRow[]).map((row) => this.session(row));
	}

	async upsertSession(
		ownerId: string,
		input: CloudChatSessionInput
	): Promise<CloudChatSession> {
		const { data, error } = await this.client
			.from('chat_sessions')
			.upsert(
				{
					id: input.id,
					owner_id: ownerId,
					title: input.title,
					model: input.model ?? null,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'id' }
			)
			.select('id,title,model,created_at,updated_at')
			.single();
		if (error) throw publicCloudError(error);
		return this.session(data as SessionRow);
	}

	async deleteSession(sessionId: string): Promise<void> {
		const { data: files, error: filesError } = await this.client
			.from('files')
			.select('object_path')
			.eq('session_id', sessionId);
		if (filesError) throw publicCloudError(filesError);
		const paths = (files as { object_path: string }[]).map((file) => file.object_path);
		if (paths.length > 0) {
			const { error } = await this.client.storage.from('user-files').remove(paths);
			if (error) throw publicCloudError(error);
		}
		const { error } = await this.client.from('chat_sessions').delete().eq('id', sessionId);
		if (error) throw publicCloudError(error);
	}

	async listMessages(sessionId: string): Promise<CloudChatMessage[]> {
		const { data, error } = await this.client
			.from('chat_messages')
			.select('id,session_id,ordinal,role,content,tool_calls,usage,created_at')
			.eq('session_id', sessionId)
			.order('ordinal', { ascending: true });
		if (error) throw publicCloudError(error);
		return (data as MessageRow[]).map((row) => this.message(row));
	}

	async upsertMessage(
		ownerId: string,
		input: CloudChatMessageInput
	): Promise<CloudChatMessage> {
		const { data, error } = await this.client
			.from('chat_messages')
			.upsert(
				{
					id: input.id,
					session_id: input.sessionId,
					owner_id: ownerId,
					ordinal: input.ordinal,
					role: input.role,
					content: input.content,
					tool_calls: input.toolCalls ?? [],
					usage: input.usage ?? null,
				},
				{ onConflict: 'id' }
			)
			.select('id,session_id,ordinal,role,content,tool_calls,usage,created_at')
			.single();
		if (error) throw publicCloudError(error);
		return this.message(data as MessageRow);
	}

	async uploadFile(ownerId: string, input: CloudFileUpload): Promise<CloudFile> {
		const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160) || 'file';
		const objectPath = `${ownerId}/sessions/${input.sessionId}/${input.id}/${safeName}`;
		const { error: storageError } = await this.client.storage
			.from('user-files')
			.upload(objectPath, input.data, { contentType: input.mimeType, upsert: false });
		if (storageError) throw publicCloudError(storageError);
		const { data, error } = await this.client
			.from('files')
			.insert({
				id: input.id,
				session_id: input.sessionId,
				owner_id: ownerId,
				object_path: objectPath,
				file_name: input.fileName,
				mime_type: input.mimeType,
				size_bytes: input.data.byteLength,
			})
			.select('id,session_id,file_name,mime_type,size_bytes,created_at')
			.single();
		if (error) {
			await this.client.storage.from('user-files').remove([objectPath]).catch(() => undefined);
			throw publicCloudError(error);
		}
		return this.file(data as FileRow);
	}

	async downloadFile(fileId: string): Promise<ArrayBuffer> {
		const { data: record, error: recordError } = await this.client
			.from('files')
			.select('object_path')
			.eq('id', fileId)
			.single();
		if (recordError) throw publicCloudError(recordError);
		const { data, error } = await this.client.storage
			.from('user-files')
			.download((record as { object_path: string }).object_path);
		if (error) throw publicCloudError(error);
		return data.arrayBuffer();
	}

	async deleteFile(fileId: string): Promise<void> {
		const { data: record, error: recordError } = await this.client
			.from('files')
			.select('object_path')
			.eq('id', fileId)
			.single();
		if (recordError) throw publicCloudError(recordError);
		const { error: storageError } = await this.client.storage
			.from('user-files')
			.remove([(record as { object_path: string }).object_path]);
		if (storageError) throw publicCloudError(storageError);
		const { error } = await this.client.from('files').delete().eq('id', fileId);
		if (error) throw publicCloudError(error);
	}

	async watchSession(
		sessionId: string,
		listener: (event: CloudChange['event']) => void
	): Promise<void> {
		if (this.channels.has(sessionId)) return;
		const { data, error } = await this.client
			.from('chat_sessions')
			.select('id')
			.eq('id', sessionId)
			.single();
		if (error || !data) throw publicCloudError(error);
		const channel = this.client
			.channel(`chat:${sessionId}`, { config: { private: true } })
			.on('broadcast', { event: '*' }, (payload) => {
				const event = this.event(payload.event);
				if (event) listener(event);
			});
		this.channels.set(sessionId, channel);
		try {
			await new Promise<void>((resolve, reject) => {
				channel.subscribe((status) => {
					if (status === 'SUBSCRIBED') resolve();
					else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
						reject(new Error('Cloud updates are temporarily unavailable.'));
					}
				});
			});
		} catch (error) {
			this.channels.delete(sessionId);
			await this.client.removeChannel(channel);
			throw error;
		}
	}

	async unwatchSession(sessionId: string): Promise<void> {
		const channel = this.channels.get(sessionId);
		if (!channel) return;
		this.channels.delete(sessionId);
		await this.client.removeChannel(channel);
	}

	async clearWatches(): Promise<void> {
		this.channels.clear();
		await this.client.removeAllChannels();
	}

	private event(event: string): CloudChange['event'] | undefined {
		if (event === 'INSERT') return 'created';
		if (event === 'UPDATE') return 'updated';
		if (event === 'DELETE') return 'deleted';
		return undefined;
	}

	private session(row: SessionRow): CloudChatSession {
		return {
			id: row.id,
			title: row.title,
			...(row.model ? { model: row.model } : {}),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	private message(row: MessageRow): CloudChatMessage {
		return {
			id: row.id,
			sessionId: row.session_id,
			ordinal: row.ordinal,
			role: row.role,
			content: row.content,
			toolCalls: row.tool_calls,
			...(row.usage === null ? {} : { usage: row.usage }),
			createdAt: row.created_at,
		};
	}

	private file(row: FileRow): CloudFile {
		return {
			id: row.id,
			sessionId: row.session_id,
			fileName: row.file_name,
			mimeType: row.mime_type,
			sizeBytes: row.size_bytes,
			createdAt: row.created_at,
		};
	}
}
