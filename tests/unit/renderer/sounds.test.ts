import { configureSounds } from '../../../src/renderer/src/lib/sounds/configure';
import { playSound } from '../../../src/renderer/src/lib/sounds/play';
import { soundState } from '../../../src/renderer/src/lib/sounds/state';

let players: Array<{ play: jest.Mock; pause: jest.Mock; currentTime: number; volume: number }>;
let audio: jest.SpyInstance;
let now: jest.SpyInstance;

beforeEach(() => {
	soundState.enabled = false;
	soundState.players.clear();
	soundState.lastPlayed.clear();
	players = [];
	now = jest.spyOn(performance, 'now').mockReturnValue(100);
	audio = jest.spyOn(window, 'Audio').mockImplementation(() => {
		const player = {
			play: jest.fn().mockResolvedValue(undefined),
			pause: jest.fn(),
			currentTime: 0,
			volume: 1,
		};
		players.push(player);
		return player as unknown as HTMLAudioElement;
	});
});

afterEach(() => {
	configureSounds(false);
	jest.restoreAllMocks();
});

it('keeps feedback silent until the preference is enabled', () => {
	playSound('navigate');
	expect(audio).not.toHaveBeenCalled();

	configureSounds(true);
	playSound('navigate');
	expect(players[0].play).toHaveBeenCalledTimes(1);
});

it('immediately stops active sounds and prevents more playback when muted', () => {
	configureSounds(true);
	playSound('send');
	playSound('thinking');
	configureSounds(false);
	playSound('response');

	expect(audio).toHaveBeenCalledTimes(2);
	for (const player of players) {
		expect(player.pause).toHaveBeenCalledTimes(1);
		expect(player.play).toHaveBeenCalledTimes(1);
	}
});

it('suppresses rapid duplicate cues while allowing different cues and later repeats', () => {
	configureSounds(true);
	playSound('navigate');
	now.mockReturnValue(130);
	playSound('navigate');
	playSound('send');
	expect(players[0].play).toHaveBeenCalledTimes(1);
	expect(players[1].play).toHaveBeenCalledTimes(1);

	players[0].currentTime = 0.2;
	now.mockReturnValue(180);
	playSound('navigate');
	expect(audio).toHaveBeenCalledTimes(2);
	expect(players[0].play).toHaveBeenCalledTimes(2);
	expect(players[0].currentTime).toBe(0);
});

it('allows immediate playback when feedback is enabled again', () => {
	configureSounds(true);
	playSound('navigate');
	configureSounds(false);
	configureSounds(true);
	playSound('navigate');

	expect(players[0].play).toHaveBeenCalledTimes(2);
});

it('contains rejected playback promises and allows later playback', async () => {
	configureSounds(true);
	playSound('response');
	players[0].play.mockRejectedValueOnce(new Error('Playback is unavailable'));
	now.mockReturnValue(200);
	expect(() => playSound('response')).not.toThrow();
	await Promise.resolve();

	now.mockReturnValue(300);
	playSound('response');
	expect(players[0].play).toHaveBeenCalledTimes(3);
});

it('does not interrupt the user action when audio creation fails', () => {
	configureSounds(true);
	audio.mockImplementationOnce(() => {
		throw new Error('Audio is unavailable');
	});

	expect(() => playSound('theme')).not.toThrow();
});
