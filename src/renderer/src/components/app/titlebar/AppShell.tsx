import { AppTitleBar } from './AppTitleBar';
import { useAppTheme } from './hooks/useAppTheme';

export function AppShell(): React.JSX.Element {
	useAppTheme();

	return (
		<div className="app-translucent-window flex h-full flex-col overflow-hidden bg-background text-foreground">
			<AppTitleBar />
		</div>
	);
}
