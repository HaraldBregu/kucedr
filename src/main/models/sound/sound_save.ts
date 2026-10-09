import { saveMedia } from '../../shared/media';
import type { SoundResult } from '../../../shared/sound_types';

export async function saveSoundFile(result: SoundResult): Promise<void> {
	const ext = result.mimeType.includes('mpeg')
		? 'mp3'
		: result.mimeType.split('/')[1]?.split('+')[0] || 'mp3';
	await saveMedia('sound', ext, result.base64);
}
