import { createFormMusicAdapter } from './tta_form';
import { createHexMusicAdapter } from './tta_hex';
import { createInteractionsMusicAdapter } from './tta_interactions';
import { createJobsMusicAdapter } from './tta_jobs';
import { createKeyedMusicAdapter } from './tta_keyed';
import { createTaskMusicAdapter } from './tta_task';
import { MusicProviderUnsupportedError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

const MUSIC_PROTOCOLS: Readonly<Record<string, (spec: MusicProviderSpec) => MusicAdapter>> = {
	music: createKeyedMusicAdapter,
	'sound-generation': createKeyedMusicAdapter,
	interactions: createInteractionsMusicAdapter,
	task: createTaskMusicAdapter,
	jobs: createJobsMusicAdapter,
	'music-generation': createHexMusicAdapter,
	'text-to-audio-form': createFormMusicAdapter,
};

export function buildMusicAdapter(spec: MusicProviderSpec, modelName: string): MusicAdapter {
	const create =
		spec.protocol && Object.hasOwn(MUSIC_PROTOCOLS, spec.protocol)
			? MUSIC_PROTOCOLS[spec.protocol]
			: undefined;
	if (!create) {
		throw new MusicProviderUnsupportedError(
			`${modelName} (${spec.name}) declares no supported protocol.`
		);
	}
	return create(spec);
}
