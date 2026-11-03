import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';

it('loads every bundled xAI model', () => {
	const plugin = readPlugin(path.resolve('resources/plugins/xai'), 'xai', true);

	expect(plugin.provider?.models?.map((model) => model.id).sort()).toEqual([
		'grok-4.3',
		'grok-4.6',
		'grok-4.7',
		'grok-build-0.1',
		'grok-imagine-image',
		'grok-imagine-image-2.0',
		'grok-imagine-image-quality',
		'grok-imagine-video-1.5',
		'grok-voice-latest',
		'xai-stt-batch',
		'xai-stt-streaming',
		'xai-tts',
	]);
});
