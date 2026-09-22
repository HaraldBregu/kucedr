export type CloudJson =
	| string
	| number
	| boolean
	| null
	| { [key: string]: CloudJson | undefined }
	| CloudJson[];

export interface CloudChatSession {
	id: string;
	title: string;
	model?: string;
	createdAt: string;
	updatedAt: string;
}

export interface CloudChatSessionInput {
	id: string;
	title: string;
	model?: string;
}

export interface CloudChatMessage {
	id: string;
	sessionId: string;
	ordinal: number;
	role: 'system' | 'user' | 'assistant';
	content: CloudJson;
	toolCalls: CloudJson[];
	usage?: CloudJson;
	createdAt: string;
}

export interface CloudChatMessageInput {
	id: string;
	sessionId: string;
	ordinal: number;
	role: 'system' | 'user' | 'assistant';
	content: CloudJson;
	toolCalls?: CloudJson[];
	usage?: CloudJson;
}

export interface CloudFile {
	id: string;
	sessionId: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface CloudFileUpload {
	id: string;
	sessionId: string;
	fileName: string;
	mimeType: string;
	data: ArrayBuffer;
}

export interface CloudChange {
	sessionId: string;
	event: 'created' | 'updated' | 'deleted';
}

export interface CloudApi {
	listSessions: () => Promise<CloudChatSession[]>;
	upsertSession: (input: CloudChatSessionInput) => Promise<CloudChatSession>;
	deleteSession: (sessionId: string) => Promise<void>;
	listMessages: (sessionId: string) => Promise<CloudChatMessage[]>;
	upsertMessage: (input: CloudChatMessageInput) => Promise<CloudChatMessage>;
	uploadFile: (input: CloudFileUpload) => Promise<CloudFile>;
	downloadFile: (fileId: string) => Promise<ArrayBuffer>;
	deleteFile: (fileId: string) => Promise<void>;
	watchSession: (sessionId: string) => Promise<void>;
	unwatchSession: (sessionId: string) => Promise<void>;
	onSessionChanged: (callback: (change: CloudChange) => void) => () => void;
}
