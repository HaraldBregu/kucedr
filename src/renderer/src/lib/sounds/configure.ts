import { soundState } from './state';

export function configureSounds(enabled: boolean): void {
	soundState.enabled = enabled;
	if (enabled) return;
	for (const player of soundState.players.values()) player.pause();
	soundState.lastPlayed.clear();
}
