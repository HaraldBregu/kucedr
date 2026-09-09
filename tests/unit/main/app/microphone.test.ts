let mockAppStore: Record<string, unknown> = {};

jest.mock('electron-store', () =>
	jest.fn().mockImplementation(({ name, defaults }: { name: string; defaults: object }) => {
		let backing: Record<string, unknown> = { ...defaults };
		if (name === 'app') mockAppStore = backing;
		return {
			path: `/settings/${name}.json`,
			get(key: string) {
				return backing[key];
			},
			set(key: string, value: unknown) {
				backing[key] = value;
			},
			get store() {
				return backing;
			},
			set store(value: Record<string, unknown>) {
				backing = value;
				if (name === 'app') mockAppStore = backing;
			},
		};
	})
);

import { getMicrophoneInputId, setMicrophoneInputId } from '../../../../src/main/settings_store';

it('uses the system default before a microphone is selected', () => {
	expect(getMicrophoneInputId()).toBe('default');
});

it('persists a selected microphone and restores the system default', () => {
	setMicrophoneInputId('usb-microphone');
	expect(mockAppStore.microphoneInputId).toBe('usb-microphone');
	expect(getMicrophoneInputId()).toBe('usb-microphone');
	setMicrophoneInputId('default');
	expect(getMicrophoneInputId()).toBe('default');
});

it.each([null, undefined, 42, {}, '', '   '])('rejects an invalid microphone ID: %p', (inputId) => {
	setMicrophoneInputId('usb-microphone');
	expect(() => setMicrophoneInputId(inputId as string)).toThrow('Invalid microphone input ID.');
	expect(getMicrophoneInputId()).toBe('usb-microphone');
});
