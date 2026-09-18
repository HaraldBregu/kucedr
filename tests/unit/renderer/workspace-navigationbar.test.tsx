import { act, renderHook } from '@testing-library/react';
import { useNavigationBar } from '../../../resources/apps/workspace/src/hooks/navigationbar';

const setNavigationBarOptions = jest.fn();
const stopButtonClicks = jest.fn();
let buttonClicked: (buttonId: string) => void;

jest.mock('@kucedr/sdk', () => ({
	isKucedr: () => true,
	win: {
		setNavigationBarOptions: (options: unknown) => setNavigationBarOptions(options),
		onNavigationBarButtonClick: (callback: (buttonId: string) => void) => {
			buttonClicked = callback;
			return stopButtonClicks;
		},
	},
}));

beforeEach(() => {
	setNavigationBarOptions.mockClear();
	stopButtonClicks.mockClear();
});

it('publishes Workspace sidebar state and handles host toggle clicks', () => {
	const setSidebarOpen = jest.fn();
	const { rerender, unmount } = renderHook(
		({ sidebarOpen, sidebarWidth }) =>
			useNavigationBar({ sidebarOpen, sidebarWidth, setSidebarOpen }),
		{ initialProps: { sidebarOpen: true, sidebarWidth: 240 } }
	);

	expect(setNavigationBarOptions).toHaveBeenLastCalledWith({
		leftButtons: [
			{
				id: 'toggle-sidebar',
				label: 'Collapse sidebar',
				icon: 'panel-left',
				expanded: true,
			},
		],
		sidebarOpen: true,
		sidebarWidth: 240,
	});

	act(() => buttonClicked('toggle-sidebar'));
	const update = setSidebarOpen.mock.calls[0]?.[0] as (open: boolean) => boolean;
	expect(update(true)).toBe(false);

	rerender({ sidebarOpen: false, sidebarWidth: 320 });
	expect(setNavigationBarOptions).toHaveBeenLastCalledWith(
		expect.objectContaining({ sidebarOpen: false, sidebarWidth: 320 })
	);

	unmount();
	expect(stopButtonClicks).toHaveBeenCalledTimes(1);
	expect(setNavigationBarOptions).toHaveBeenLastCalledWith(null);
});
