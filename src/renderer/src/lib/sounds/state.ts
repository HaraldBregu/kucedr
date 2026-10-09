import navigate from '@resources/sounds/click_001.ogg';
import send from '@resources/sounds/pluck_001.ogg';
import thinking from '@resources/sounds/question_003.ogg';
import response from '@resources/sounds/confirmation_001.ogg';
import theme from '@resources/sounds/toggle_004.ogg';

export const soundSources = { navigate, send, thinking, response, theme };
export type FeedbackSound = keyof typeof soundSources;

export const soundState = {
	enabled: false,
	players: new Map<FeedbackSound, HTMLAudioElement>(),
	lastPlayed: new Map<FeedbackSound, number>(),
};
