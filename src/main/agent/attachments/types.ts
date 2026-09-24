import type { AgentPromptInputCapabilities } from '../../../shared/agent_types';

export type PromptAttachmentBlock =
	| {
			type: 'text_file';
			name: string;
			mimeType: string;
			bytes: number;
			path?: string;
			text: string;
	  }
	| {
			type: 'image';
			name: string;
			mimeType: string;
			bytes: number;
			path?: string;
			base64: string;
	  }
	| {
			type: 'document';
			name: string;
			mimeType: 'application/pdf';
			bytes: number;
			path?: string;
			base64: string;
	  };

export interface PromptModelSelection {
	providerId: string;
	modelId: string;
	capabilities: AgentPromptInputCapabilities;
}
