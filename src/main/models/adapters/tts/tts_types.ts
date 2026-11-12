import type {
	SpeechSynthesisRequest,
	SpeechSynthesisResult,
} from '../../../../shared/speech_types';
import type { ModelMetadata } from '../../../../shared/model_types';

export interface SpeechProviderSpec {
	id: string;
	name: string;
	apiKey: string;
	baseURL: string;
	protocol?: string;
}

export interface SpeechAdapterRequest extends SpeechSynthesisRequest {
	providerId: string;
	modelId: string;
	metadata?: ModelMetadata;
}

export interface SpeechAdapter {
	synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult>;
}
