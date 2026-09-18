import {
	MoreHorizontal,
	PanelLeft,
	PanelRight,
	Plus,
	RefreshCw,
	Search,
	Settings,
} from 'lucide-react';
import type { AppNavigationBarButtonIcon } from '@shared/window_types';

interface AppNavigationBarIconProps {
	readonly icon: AppNavigationBarButtonIcon;
}

export function AppNavigationBarIcon({ icon }: AppNavigationBarIconProps): React.JSX.Element {
	switch (icon) {
		case 'panel-left':
			return <PanelLeft />;
		case 'panel-right':
			return <PanelRight />;
		case 'plus':
			return <Plus />;
		case 'settings':
			return <Settings />;
		case 'search':
			return <Search />;
		case 'refresh':
			return <RefreshCw />;
		case 'more-horizontal':
			return <MoreHorizontal />;
	}
}
