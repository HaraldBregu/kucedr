import {
	MoreHorizontal,
	PanelLeft,
	PanelRight,
	Plus,
	RefreshCw,
	Search,
	Settings,
} from 'lucide-react';
import type { AppTitlebarButtonIcon } from '../../../../../shared/window_types';

export function AppTitlebarIcon({
	icon,
}: {
	icon: AppTitlebarButtonIcon;
}): React.JSX.Element {
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
