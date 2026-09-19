import type { RealtimeVoiceAdapterRequest } from './realtime_voice_types';

export async function turnContext(
	lookup: RealtimeVoiceAdapterRequest['contextForTurn'],
	transcript: string
): Promise<string> {
	if (!lookup) return '';
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			lookup(transcript).then((context) => context.slice(0, 4000)),
			new Promise<string>((resolve) => {
				timer = setTimeout(() => resolve(''), 1500);
				timer.unref?.();
			}),
		]);
	} catch {
		return '';
	} finally {
		if (timer) clearTimeout(timer);
	}
}
