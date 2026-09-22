import { useEffect, useState } from 'react';
import type { AppNavigationBarOptions } from '@shared/window_types';
import { AppNavigationBar } from './AppNavigationBar';
import { useAppTheme } from './hooks/useAppTheme';

export function AppShell(): React.JSX.Element {
	useAppTheme();
	const [options, setOptions] = useState<AppNavigationBarOptions | null>(null);

	useEffect(() => window.win.onNavigationBarOptionsChanged(setOptions), []);

	return (
		<div className="app-translucent-window flex h-full flex-col overflow-hidden bg-background text-foreground">
			{options ? (
				<AppNavigationBar
					leftButtons={options.leftButtons}
					rightButtons={options.rightButtons}
				/>
			) : null}
		</div>
	);
}
