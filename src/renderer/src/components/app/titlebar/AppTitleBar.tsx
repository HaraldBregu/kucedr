import { TitleBarContainer } from './TitleBarContainer';
import { AppWindowControls } from './AppWindowControls';
import { useAppWindowState } from './hooks/useAppWindowState';

const isMac =
	typeof navigator !== 'undefined' &&
	(navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

export function AppTitleBar(): React.JSX.Element {
	const isMaximized = useAppWindowState();

	return (
		<TitleBarContainer className="relative">
			{!isMac ? <AppWindowControls isMaximized={isMaximized} /> : null}
		</TitleBarContainer>
	);
}
