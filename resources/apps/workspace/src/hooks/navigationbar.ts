import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { isKucedr, win } from '@kucedr/sdk';

const sidebarToggleButtonId = 'toggle-sidebar';

interface NavigationBarOptions {
	readonly sidebarOpen: boolean;
	readonly sidebarWidth: number;
	readonly setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export function useNavigationBar({
	sidebarOpen,
	sidebarWidth,
	setSidebarOpen,
}: NavigationBarOptions): void {
	useEffect(() => {
		if (!isKucedr()) return;
		return win.onNavigationBarButtonClick((buttonId) => {
			if (buttonId === sidebarToggleButtonId) setSidebarOpen((open) => !open);
		});
	}, [setSidebarOpen]);

	useEffect(() => {
		if (!isKucedr()) return;
		win.setNavigationBarOptions({
			leftButtons: [
				{
					id: sidebarToggleButtonId,
					label: sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar',
					icon: 'panel-left',
					expanded: sidebarOpen,
				},
			],
			sidebarOpen,
			sidebarWidth,
		});
	}, [sidebarOpen, sidebarWidth]);

	useEffect(() => {
		if (!isKucedr()) return;
		return () => win.setNavigationBarOptions(null);
	}, []);
}
