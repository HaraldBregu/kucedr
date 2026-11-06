import click from '@resources/sounds/bencho_click.wav';
import thinking from '@resources/sounds/bencho_thinking.wav';

export const soundSources = { navigate: click, send: click, thinking, response: click, theme: click };
export type FeedbackSound = keyof typeof soundSources;

export const soundState = {
	enabled: false,
	players: new Map<FeedbackSound, HTMLAudioElement>(),
	lastPlayed: new Map<FeedbackSound, number>(),
};
