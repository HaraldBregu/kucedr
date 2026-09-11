import { act, render, screen } from '@testing-library/react';
import {
	SettingsAutoDismiss,
	SettingsNotice,
} from '../../../src/renderer/src/pages/settings/components';

it('dismisses transient status feedback after five seconds', () => {
	jest.useFakeTimers();
	render(
		<>
			<SettingsNotice autoDismiss>Uploaded 1 app.</SettingsNotice>
			<SettingsAutoDismiss>
				<p>Settings saved.</p>
			</SettingsAutoDismiss>
		</>
	);

	expect(screen.getByText('Uploaded 1 app.')).toBeInTheDocument();
	expect(screen.getByText('Settings saved.')).toBeInTheDocument();
	act(() => jest.advanceTimersByTime(5_000));
	expect(screen.queryByText('Uploaded 1 app.')).not.toBeInTheDocument();
	expect(screen.queryByText('Settings saved.')).not.toBeInTheDocument();
	jest.useRealTimers();
});
