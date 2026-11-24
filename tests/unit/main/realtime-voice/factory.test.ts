import fs from 'node:fs';
import path from 'node:path';
import {
	buildRealtimeVoiceAdapter,
	FlatRealtimeVoiceAdapter,
	LiveVoiceAdapter,
	RealtimeSessionVoiceAdapter,
	realtimeVoiceProtocol,
} from '../../../../src/main/models/adapters/realtime_voice';

const provider = { id: 'openai', name: 'OpenAI', apiKey: 'key' };
const model = (protocol?: string) =>
	({ id: 'model', name: 'Model', metadata: protocol ? { protocol } : undefined }) as never;

describe('realtime voice adapter factory', () => {
	it('covers every realtime voice model in the bundled provider catalog', () => {
		const root = path.resolve(__dirname, '../../../../resources/plugins');
		const catalog = fs.readdirSync(root).flatMap((providerId) => {
			const modelsPath = path.join(root, providerId, 'models');
			if (!fs.existsSync(modelsPath)) return [];
			return fs.readdirSync(modelsPath).flatMap((modelDirectory) => {
				const manifestPath = path.join(modelsPath, modelDirectory, 'manifest.json');
				if (!fs.existsSync(manifestPath)) return [];
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
				return manifest.type === 'realtime-voice-model' ? [manifest] : [];
			});
		});
		expect(catalog.length).toBeGreaterThan(0);
		for (const manifest of catalog) {
			expect(() => realtimeVoiceProtocol(manifest, manifest.name)).not.toThrow();
		}
	});

	it('enables tools for every protocol except live', () => {
		expect(realtimeVoiceProtocol(model('realtime'), 'OpenAI').tools).toBe(true);
		expect(realtimeVoiceProtocol(model('realtime-flat'), 'xAI').tools).toBe(true);
		expect(realtimeVoiceProtocol(model('agent'), 'Deepgram').tools).toBe(true);
		expect(realtimeVoiceProtocol(model('live'), 'OpenAI').tools).toBe(false);
	});

	it('builds the adapter declared by the model protocol and rejects unknown protocols', () => {
		expect(buildRealtimeVoiceAdapter(provider, model('realtime'))).toBeInstanceOf(
			RealtimeSessionVoiceAdapter
		);
		expect(buildRealtimeVoiceAdapter(provider, model('realtime-flat'))).toBeInstanceOf(
			FlatRealtimeVoiceAdapter
		);
		expect(buildRealtimeVoiceAdapter(provider, model('live'))).toBeInstanceOf(LiveVoiceAdapter);
		expect(() => buildRealtimeVoiceAdapter(provider, model('unknown'))).toThrow(
			'declares no supported protocol'
		);
		expect(() => buildRealtimeVoiceAdapter(provider, model())).toThrow(
			'declares no supported protocol'
		);
	});
});

function providerIdOf(manifest: { name?: string }): string {
	return manifest.name ?? '';
}
