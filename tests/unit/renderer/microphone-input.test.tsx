import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMicrophoneInputs } from '../../../src/renderer/src/lib/microphone/inputs';
import { MicrophoneInput } from '../../../src/renderer/src/pages/settings/pages/system/detail/Input';

jest.mock('react-i18next', () => {
	const t = (key: string, options?: { number: number }): string =>
		options ? `${key} ${options.number}` : key;
	return { useTranslation: () => ({ t }) };
});

const key = 'settings.system.media.microphone';
const builtIn = {
	kind: 'audioinput', deviceId: 'built-in', groupId: 'built-in-group', label: 'MacBook Microphone',
} as MediaDeviceInfo;
const usb = {
	kind: 'audioinput', deviceId: 'usb', groupId: 'usb-group', label: 'USB Microphone',
} as MediaDeviceInfo;
const systemDefault = {
	...builtIn, deviceId: 'default', label: 'Default - MacBook Microphone',
} as MediaDeviceInfo;
const api = {
	getMicrophoneInputId: jest.fn(),
	setMicrophoneInputId: jest.fn(),
};
let devices: MediaDeviceInfo[];
let mediaDevices: EventTarget & { enumerateDevices: jest.Mock };

beforeEach(() => {
	devices = [systemDefault, builtIn, usb];
	mediaDevices = Object.assign(new EventTarget(), {
		enumerateDevices: jest.fn(async () => devices),
	});
	Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: mediaDevices });
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'app', { configurable: true, value: api });
	api.getMicrophoneInputId.mockResolvedValue('usb');
	api.setMicrophoneInputId.mockResolvedValue(undefined);
});

it('resolves the current host default to its physical microphone and filters aliases', async () => {
	devices.push({ ...usb, deviceId: 'communications' });
	devices.push({ ...builtIn, kind: 'audiooutput', deviceId: 'speaker' });
	expect(await getMicrophoneInputs()).toEqual({ inputs: [builtIn, usb], currentInput: builtIn });
	devices = [{ ...systemDefault, groupId: usb.groupId }, builtIn, usb];
	expect((await getMicrophoneInputs()).currentInput).toBe(usb);
});

it('keeps an unknown host default unresolved instead of guessing a physical input', async () => {
	devices = [builtIn, usb];
	expect((await getMicrophoneInputs()).currentInput).toBeNull();
	devices = [{ ...systemDefault, groupId: '' }, builtIn, usb];
	expect((await getMicrophoneInputs()).currentInput?.deviceId).toBe('default');
});

it('refreshes connected inputs without replacing the saved choice', async () => {
	const user = userEvent.setup();
	render(<MicrophoneInput refreshKey="granted-idle" disabled={false} />);
	const select = screen.getByRole('combobox', { name: `${key}.label` });
	await waitFor(() => expect(select).toHaveTextContent('USB Microphone'));
	await user.click(select);
	expect(await screen.findByRole('option', { name: 'USB Microphone' })).toBeInTheDocument();
	await act(async () => {
		devices = [systemDefault, builtIn];
		mediaDevices.dispatchEvent(new Event('devicechange'));
	});
	expect(screen.queryByRole('option', { name: 'USB Microphone' })).not.toBeInTheDocument();
	expect(select).toHaveTextContent(`${key}.unavailable`);
	expect(screen.getByRole('option', { name: `${key}.unavailable` })).toHaveAttribute('aria-disabled', 'true');
	await act(async () => {
		devices = [systemDefault, builtIn, usb];
		mediaDevices.dispatchEvent(new Event('devicechange'));
	});
	expect(await screen.findByRole('option', { name: 'USB Microphone' })).toBeInTheDocument();
	expect(select).toHaveTextContent('USB Microphone');
	expect(api.setMicrophoneInputId).not.toHaveBeenCalled();
});

it('shows the current system microphone and saves the system default selection', async () => {
	const user = userEvent.setup();
	render(<MicrophoneInput refreshKey="granted-idle" disabled={false} />);
	const select = screen.getByRole('combobox', { name: `${key}.label` });
	await waitFor(() => expect(select).toHaveTextContent('USB Microphone'));
	await user.click(select);
	await user.click(await screen.findByRole('option', { name: `${key}.systemDefault (MacBook Microphone)` }));
	await waitFor(() => expect(api.setMicrophoneInputId).toHaveBeenCalledWith('default'));
	expect(select).toHaveTextContent(`${key}.systemDefault`);
});

it('keeps the previous selection and reports a failed save', async () => {
	api.setMicrophoneInputId.mockRejectedValue(new Error('Storage unavailable'));
	const user = userEvent.setup();
	render(<MicrophoneInput refreshKey="granted-idle" disabled={false} />);
	const select = screen.getByRole('combobox', { name: `${key}.label` });
	await waitFor(() => expect(select).toHaveTextContent('USB Microphone'));
	await user.click(select);
	await user.click(await screen.findByRole('option', { name: 'MacBook Microphone' }));
	expect(await screen.findByText(`${key}.saveInputError`)).toBeInTheDocument();
	expect(select).toHaveTextContent('USB Microphone');
	expect(select).not.toBeDisabled();
});

it('labels a selected input without a device name using its numbered fallback', async () => {
	devices = [systemDefault, builtIn, { ...usb, label: '' }];
	render(<MicrophoneInput refreshKey="granted-idle" disabled={false} />);
	await waitFor(() => expect(screen.getByRole('combobox', { name: `${key}.label` }))
		.toHaveTextContent(`${key}.unnamed 2`));
});
