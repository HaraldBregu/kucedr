import type { CodingSessionBlock } from '@shared/coding_types';

export type CoderBlock =
	| CodingSessionBlock
	| {
			id: string;
			type: 'tool';
			toolName: string;
			status: 'running' | 'succeeded' | 'failed';
			timestamp: string;
	  }
	| {
			id: string;
			type: 'command';
			command: string;
			output: string;
			status: 'running';
			truncated: boolean;
			timestamp: string;
	  };
