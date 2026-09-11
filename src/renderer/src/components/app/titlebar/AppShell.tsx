import { useEffect, useState } from 'react';
import { AppTitleBar } from './AppTitleBar';
import { useAppTheme } from './hooks/useAppTheme';
import type { AppTitlebarOptions } from '../../../../../shared/window_types';

interface AppShellProps {
	title: string;
}

export function AppShell({ title }: AppShellProps): React.JSX.Element {
	useAppTheme();
	const [options, setOptions] = useState<AppTitlebarOptions | null>(null);
	const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
	const [sidebarTransitionDelay, setSidebarTransitionDelay] = useState<number>();

	useEffect(() => {
		let active = true;
		let receivedOptions = false;
		const applyOptions = (nextOptions: AppTitlebarOptions | null): void => {
			setOptions(nextOptions);
			setSidebarTransitionDelay(
				nextOptions?.sidebarTransitionStartedAt === undefined
					? undefined
					: -Math.min(
							200,
							Math.max(0, Date.now() - nextOptions.sidebarTransitionStartedAt + 5)
						)
			);
		};
		const stopOptions = window.win.onTitlebarOptionsChanged((nextOptions) => {
			receivedOptions = true;
			applyOptions(nextOptions);
		});
		const stopSidebarWidth = window.win.onTitlebarSidebarWidthChanged(setSidebarWidth);
		void window.win.getTitlebarOptions().then((nextOptions) => {
			if (active && !receivedOptions) applyOptions(nextOptions);
		});
		return () => {
			active = false;
			stopOptions();
			stopSidebarWidth();
		};
	}, []);

	return (
		<div className="app-translucent-window flex h-full flex-col overflow-hidden bg-background text-foreground">
			<AppTitleBar
				title={options?.title ?? title}
				leftButtons={options?.leftButtons ?? []}
				rightButtons={options?.rightButtons ?? []}
				sidebarOpen={options?.sidebarOpen}
				sidebarTransitionDelay={sidebarTransitionDelay}
				sidebarWidth={options ? (options.sidebarWidth ?? null) : sidebarWidth}
			/>
		</div>
	);
}
