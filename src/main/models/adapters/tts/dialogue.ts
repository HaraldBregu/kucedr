import WebSocket from 'ws';
import { speechResult } from './tts_audio';
import type { SpeechProviderSpec, SpeechAdapterRequest } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

export async function synthesizeDialogue(
	provider: SpeechProviderSpec,
	request: SpeechAdapterRequest
): Promise<SpeechSynthesisResult> {
	const endpoint = new URL('text-to-dialogue/stream-input', `${provider.baseURL}/`);
	endpoint.protocol = endpoint.protocol === 'http:' ? 'ws:' : 'wss:';
	endpoint.searchParams.set('model_id', request.modelId);
	const output =
		typeof request.options?.output_format === 'string'
			? request.options.output_format
			: 'mp3_44100_128';
	endpoint.searchParams.set('output_format', output);
	const voice =
		request.voice ??
		(typeof request.options?.voice_id === 'string'
			? request.options.voice_id
			: '21m00Tcm4TlvDq8ikWAM');
	const socket = new WebSocket(endpoint, { headers: { 'xi-api-key': provider.apiKey } });
	const chunks: Buffer[] = [];
	const audio = await new Promise<Buffer>((resolve, reject) => {
		let completed = false;
		socket.once('open', () => {
			socket.send(JSON.stringify({ voices: [voice] }));
			socket.send(JSON.stringify({ inputs: [{ text: request.text, voice_id: voice }] }));
			socket.send(JSON.stringify({ close_socket: true }));
		});
		socket.once('error', reject);
		socket.once('close', () => {
			if (!completed) reject(new Error('ElevenLabs dialogue ended before final audio.'));
		});
		socket.on('message', (message) => {
			let data: { audio?: string; is_final?: boolean; error?: unknown };
			try {
				data = JSON.parse(message.toString());
			} catch {
				return;
			}
			if (data.error) {
				reject(new Error(`ElevenLabs dialogue failed: ${JSON.stringify(data.error)}`));
				socket.close();
				return;
			}
			if (data.audio) chunks.push(Buffer.from(data.audio, 'base64'));
			if (data.is_final) {
				completed = true;
				resolve(Buffer.concat(chunks));
				socket.close(1000, 'completed');
			}
		});
	});
	const mimeType = output.startsWith('mp3')
		? 'audio/mpeg'
		: output.startsWith('opus')
			? 'audio/ogg'
			: output.startsWith('wav')
				? 'audio/wav'
				: 'application/octet-stream';
	return speechResult(audio.toString('base64'), mimeType, provider, request);
}
