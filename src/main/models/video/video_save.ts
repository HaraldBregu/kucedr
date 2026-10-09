import { saveMedia } from '../../shared/media';
import type { VideoResult } from '../../../shared/video_types';

export async function saveVideoFile(result: VideoResult): Promise<string> {
	const ext = result.mimeType.split('/')[1]?.split('+')[0] || 'mp4';
	return saveMedia('video', ext, result.base64);
}
