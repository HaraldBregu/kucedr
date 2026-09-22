import type {
	CloudChange,
	CloudChatMessage,
	CloudChatMessageInput,
	CloudChatSession,
	CloudChatSessionInput,
	CloudFile,
	CloudFileUpload,
} from '../../shared/cloud_types';

export interface CloudRepository {
	setAccessToken(accessToken: string | null): Promise<void>;
	listSessions(): Promise<CloudChatSession[]>;
	upsertSession(ownerId: string, input: CloudChatSessionInput): Promise<CloudChatSession>;
	deleteSession(sessionId: string): Promise<void>;
	listMessages(sessionId: string): Promise<CloudChatMessage[]>;
	upsertMessage(ownerId: string, input: CloudChatMessageInput): Promise<CloudChatMessage>;
	uploadFile(ownerId: string, input: CloudFileUpload): Promise<CloudFile>;
	downloadFile(fileId: string): Promise<ArrayBuffer>;
	deleteFile(fileId: string): Promise<void>;
	watchSession(
		sessionId: string,
		listener: (event: CloudChange['event']) => void
	): Promise<void>;
	unwatchSession(sessionId: string): Promise<void>;
	clearWatches(): Promise<void>;
}
