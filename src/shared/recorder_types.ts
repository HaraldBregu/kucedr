export interface RecordConfig {
	url: string;
	duration?: number;
	sourceId?: string;
}

export type RecordingStatus =
	| 'selecting'
	| 'recording'
	| 'stopping'
	| 'saving'
	| 'completed'
	| 'cancelled'
	| 'error';

export interface Recording {
	id: string;
	url: string;
	duration?: number;
	status: RecordingStatus;
	startedAt: number;
	mimeType?: string;
	size?: number;
	error?: string;
}

export type RecorderCommand =
	| { type: 'start'; id: string; duration?: number; sourceId?: string }
	| { type: 'stop'; id: string }
	| { type: 'cancel'; id: string };

export interface RecorderCaptureResult {
	id: string;
	mimeType?: string;
	error?: string;
}

export interface RecorderCaptureChunk {
	id: string;
	sequence: number;
	data: Uint8Array;
}
