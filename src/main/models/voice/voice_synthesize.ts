import { synthesize as synthesizeTextToSpeech } from '../adapters/tts';
import type { SpeechSynthesisRequest, SpeechSynthesisResult } from '../../../shared/speech_types';

export async function synthesize(
	request: SpeechSynthesisRequest,
	selection: 'chatbot' | 'tool' = 'chatbot'
): Promise<SpeechSynthesisResult> {
	return synthesizeTextToSpeech(request, selection);
}
