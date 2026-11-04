import click from '@resources/sounds/bencho_click.wav';
import thinking from '@resources/sounds/question_003.ogg';
import response from '@resources/sounds/confirmation_001.ogg';

export const soundSources = { navigate: click, send: click, thinking, response, theme: click };
export type FeedbackSound = keyof typeof soundSources;

export const soundState = {
	enabled: false,
	players: new Map<FeedbackSound, HTMLAudioElement>(),
	lastPlayed: new Map<FeedbackSound, number>(),
};
