const getToolModel = jest.fn();
const authorizeFilePath = jest.fn();
const readFileBounded = jest.fn();
const transcribe = jest.fn();

jest.mock('../../../../../src/main/agent/agent_store', () => ({ getToolModel }));
jest.mock('../../../../../src/main/agent/files/authorize', () => ({ authorizeFilePath }));
jest.mock('../../../../../src/main/agent/files/read', () => ({ readFileBounded }));
jest.mock('../../../../../src/main/models/transcribe', () => ({ transcribe }));

import { speechToTextTool } from '../../../../../src/main/agent/tools/media/speech_to_text';

beforeEach(() => {
	jest.clearAllMocks();
	getToolModel.mockReturnValue({ providerId: 'openai', modelId: 'gpt-transcribe', options: {} });
	authorizeFilePath.mockReturnValue('/agent/recording.wav');
	readFileBounded.mockResolvedValue(Buffer.from('audio'));
	transcribe.mockResolvedValue({ text: 'Hello', metadata: { modelId: 'gpt-transcribe' } });
});

it('transcribes an approved audio file with the tool speech-to-text model', async () => {
	const controller = new AbortController();
	await expect(
		speechToTextTool().run(
			{ path: '/agent/recording.wav', language: 'en', prompt: 'Kucedr' },
			controller.signal
		)
	).resolves.toEqual({ text: 'Hello', metadata: { modelId: 'gpt-transcribe' } });

	expect(readFileBounded).toHaveBeenCalledWith(
		'/agent/recording.wav',
		expect.any(Number),
		controller.signal
	);
	expect(transcribe).toHaveBeenCalledWith({
		audio: {
			data: Buffer.from('audio').toString('base64'),
			encoding: 'base64',
			mimeType: 'audio/wav',
			fileName: 'recording.wav',
			byteLength: 5,
		},
		providerId: 'openai',
		modelId: 'gpt-transcribe',
		language: 'en',
		prompt: 'Kucedr',
	});
});

it('requires a dedicated tool speech-to-text selection', async () => {
	getToolModel.mockReturnValue({ providerId: '', modelId: '', options: {} });

	await expect(speechToTextTool().run({ path: '/agent/recording.wav' })).rejects.toThrow(
		'Configure a Speech to text tool model'
	);
	expect(authorizeFilePath).not.toHaveBeenCalled();
});
