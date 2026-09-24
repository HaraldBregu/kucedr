export type PromptAttachment = {
	readonly id: string;
	readonly kind: 'file' | 'audio';
	readonly file: File;
	readonly path?: string;
	readonly url?: string;
	readonly durationMs?: number;
};
