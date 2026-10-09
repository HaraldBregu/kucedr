import {
	getSoundFeedbackEnabled,
	setSoundFeedbackEnabled,
} from '../../../../src/main/settings_store';

it('disables feedback sounds by default', () => {
	expect(getSoundFeedbackEnabled()).toBe(false);
});

it('stores the preference when feedback sounds are disabled and enabled', () => {
	setSoundFeedbackEnabled(false);
	expect(getSoundFeedbackEnabled()).toBe(false);
	setSoundFeedbackEnabled(true);
	expect(getSoundFeedbackEnabled()).toBe(true);
});

it.each([null, undefined, 0, 1, 'false', {}])('rejects an invalid sound preference: %p', (value) => {
	setSoundFeedbackEnabled(false);
	expect(() => setSoundFeedbackEnabled(value as boolean)).toThrow('Invalid sound feedback setting.');
	expect(getSoundFeedbackEnabled()).toBe(false);
});
