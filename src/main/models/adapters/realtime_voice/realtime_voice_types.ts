import type { Tool } from '../../../agent/types';

export interface RealtimeVoiceProviderSpec {
	id: string;
	name: string;
	apiKey: string;
}

export interface RealtimeVoiceHistoryMessage {
	readonly role: 'user' | 'assistant';
	readonly text: string;
}

export interface RealtimeVoiceAdapterRequest {
	contextForTurn?(transcript: string): Promise<string>;
	modelId: string;
	voice: string;
	instructions: string;
	tools: Tool[];
	history: readonly RealtimeVoiceHistoryMessage[];
}

export type RealtimeVoiceAdapterEvent =
	| { type: 'response_started'; responseId: string }
	| { type: 'input_speech_started'; itemId: string }
	| { type: 'input_speech_stopped'; itemId: string }
	| { type: 'user_transcript_final'; itemId: string; transcript: string }
	| { type: 'tool_call_start'; callId: string; itemId: string; responseId: string; name: string }
	| { type: 'assistant_transcript_delta'; itemId: string; responseId: string; delta: string }
	| { type: 'assistant_transcript_final'; itemId: string; responseId: string; transcript: string }
	| { type: 'assistant_audio_delta'; itemId: string; responseId: string; audio: string }
	| { type: 'assistant_audio_done'; itemId: string; responseId: string }
	| {
			type: 'tool_call_args_delta';
			callId: string;
			itemId: string;
			responseId: string;
			delta: string;
	  }
	| {
			type: 'tool_call';
			callId: string;
			itemId: string;
			responseId: string;
			name: string;
			arguments: string;
	  }
	| { type: 'error'; message: string }
	| { type: 'closed' };

export type RealtimeVoiceAdapterEventHandler = (event: RealtimeVoiceAdapterEvent) => void;

export interface RealtimeVoiceConnection {
	appendAudio(audio: string): Promise<void>;
	interrupt(): Promise<void>;
	addToolResult(callId: string, output: string): Promise<void>;
	stop(): Promise<void>;
}

export interface RealtimeVoiceAdapter {
	connect(
		request: RealtimeVoiceAdapterRequest,
		emit: RealtimeVoiceAdapterEventHandler,
		signal?: AbortSignal
	): Promise<RealtimeVoiceConnection>;
}

export type RealtimeVoiceClientEvent =
	| { type: 'session.update'; session: Record<string, unknown> }
	| { type: 'input_audio_buffer.append'; audio: string }
	| { type: 'response.cancel' }
	| { type: 'conversation.item.delete'; item_id: string }
	| {
			type: 'conversation.item.create';
			item:
				| { type: 'function_call_output'; call_id: string; output: string }
				| {
						type: 'message';
						id?: string;
						role: 'user';
						content: [{ type: 'input_text'; text: string }];
				  }
				| {
						type: 'message';
						role: 'assistant';
						content: [{ type: 'output_text'; text: string }];
				  };
	  }
	| { type: 'response.create' };

export type RealtimeVoiceServerEvent =
	| { type: 'session.updated' }
	| { type: 'response.created'; response: { id: string } }
	| { type: 'response.done' }
	| {
			type: 'response.output_item.added';
			response_id: string;
			item: { type: string; id?: string; call_id?: string; name?: string };
	  }
	| { type: 'input_audio_buffer.speech_started'; item_id: string }
	| { type: 'input_audio_buffer.speech_stopped'; item_id: string }
	| {
			type: 'conversation.item.input_audio_transcription.completed';
			item_id: string;
			transcript: string;
	  }
	| {
			type: 'response.output_audio_transcript.delta';
			item_id: string;
			response_id: string;
			delta: string;
	  }
	| {
			type: 'response.output_audio_transcript.done';
			item_id: string;
			response_id: string;
			transcript: string;
	  }
	| {
			type: 'response.output_audio.delta';
			item_id: string;
			response_id: string;
			delta: string;
	  }
	| { type: 'response.output_audio.done'; item_id: string; response_id: string }
	| {
			type: 'response.function_call_arguments.delta';
			call_id: string;
			item_id: string;
			response_id: string;
			delta: string;
	  }
	| {
			type: 'response.function_call_arguments.done';
			call_id: string;
			item_id: string;
			response_id: string;
			name: string;
			arguments: string;
	  }
	| { type: 'error'; error: { message: string } };

export interface RealtimeVoiceSocket {
	readonly socket: {
		readonly readyState: number;
		readonly bufferedAmount: number;
		on(event: 'open' | 'close', listener: (...args: unknown[]) => void): unknown;
	};
	on(event: 'event', listener: (event: RealtimeVoiceServerEvent) => void): unknown;
	on(event: 'error', listener: (error: Error) => void): unknown;
	send(event: RealtimeVoiceClientEvent): void;
	close(props?: { code: number; reason: string }): void;
}

export type RealtimeVoiceSocketFactory = (
	provider: RealtimeVoiceProviderSpec,
	modelId: string
) => RealtimeVoiceSocket;
