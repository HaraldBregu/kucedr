import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels } from '../../../../src/main/models';
import { createImage } from '../../../../src/main/models/image/image_create';
import { startRealtime, transcribe } from '../../../../src/main/models/adapters/stt/stt_transcribe';
import * as sttFactory from '../../../../src/main/models/adapters/stt/stt_factory';

jest.mock('@mistralai/mistralai', () => ({ Mistral: jest.fn() }));
jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => ['openai', 'elevenlabs', 'xai'].map((id) => {
		const directory = path.resolve('resources/plugins', id);
		const plugin = readPlugin(directory, id, true);
		return { directory, manifest: plugin.provider, plugin: { id, name: plugin.title } };
	}),
}));
jest.mock('../../../../src/main/settings_store', () => ({
	getProvider: () => ({ apiKey: 'test-key' }),
}));
jest.mock('../../../../src/main/models/selection', () => ({
	getProviderId: () => undefined,
	getModelId: () => undefined,
	setSelection: jest.fn(),
	resolveOptions: (_kind: string, _provider: string, _model: string, options: unknown) => options,
}));

it('declares supported image and transcription protocols for every bundled model', () => {
	for (const model of loadModels()) {
		if (model.type === 'text-to-image') expect(['images', 'images-sdk']).toContain(model.metadata?.protocol);
		if (model.type === 'speech-to-text') expect(['transcriptions', 'transcriptions-intent', 'speech-to-text', 'stt']).toContain(model.metadata?.protocol);
	}
});

it('routes a selected image model and source to its image editing endpoint', async () => {
	const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] })));
	try {
		await expect(createImage({ providerId: 'openai', modelId: 'gpt-image-2.6-sunburst', prompt: 'Edit', source: { base64: 'aGVsbG8=', mimeType: 'image/png' } })).resolves.toMatchObject({ base64: 'aGVsbG8=' });
		expect(String(fetcher.mock.calls[0][0])).toBe('https://api.openai.com/v1/images/edits');
		expect((fetcher.mock.calls[0][1]?.body as FormData).get('model')).toBe('gpt-image-2.6-sunburst');
	} finally { fetcher.mockRestore(); }
});

it('routes the selected transcription model using its own protocol', async () => {
	const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ text: 'hello' })));
	try {
		await expect(transcribe({ providerId: 'elevenlabs', modelId: 'scribe_v2', audio: { data: 'QQ==', mimeType: 'audio/wav', fileName: 'sample.wav', encoding: 'base64' } })).resolves.toMatchObject({ text: 'hello' });
		expect(String(fetcher.mock.calls[0][0])).toBe('https://api.elevenlabs.io/v1/speech-to-text');
		expect((fetcher.mock.calls[0][1]?.body as FormData).get('model_id')).toBe('scribe_v2');
	} finally { fetcher.mockRestore(); }
});

it('passes the selected realtime model metadata and sample rate to its adapter', async () => {
	const start = jest.fn().mockResolvedValue({ appendAudio: jest.fn(), finish: jest.fn(), cancel: jest.fn() });
	const factory = jest.spyOn(sttFactory, 'buildSttAdapter').mockReturnValue({ transcribe: jest.fn(), startRealtime: start });
	try {
		const session = await startRealtime({ providerId: 'elevenlabs', modelId: 'scribe_v2_realtime' }, jest.fn());
		expect(session.sampleRate).toBe(16000);
		expect(factory.mock.calls[0][0].protocol).toBe('speech-to-text');
		expect(start.mock.calls[0][0]).toMatchObject({ modelId: 'scribe_v2_realtime', sampleRate: 16000, metadata: { protocol: 'speech-to-text' } });
	} finally { factory.mockRestore(); }
});
