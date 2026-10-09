import { soundSources, soundState, type FeedbackSound } from './state';

export function playSound(sound: FeedbackSound): void {
	if (!soundState.enabled) return;
	const now = performance.now();
	const lastPlayed = soundState.lastPlayed.get(sound);
	if (lastPlayed !== undefined && now - lastPlayed < 80) return;
	try {
		let player = soundState.players.get(sound);
		if (!player) {
			player = new Audio(soundSources[sound]);
			player.volume = sound === 'navigate' || sound === 'theme' ? 0.2 : 0.3;
			soundState.players.set(sound, player);
		}
		player.currentTime = 0;
		soundState.lastPlayed.set(sound, now);
		void player.play().catch(() => undefined);
	} catch {
		return;
	}
}
