export type ContextMenuRole =
	| 'undo'
	| 'redo'
	| 'cut'
	| 'copy'
	| 'paste'
	| 'pasteAndMatchStyle'
	| 'delete'
	| 'selectAll';

export type ContextMenuDescriptor =
	| { type: 'separator' }
	| {
			type: 'role';
			role: ContextMenuRole;
			label?: string;
			enabled?: boolean;
	  }
	| {
			type?: 'item';
			id: string;
			label: string;
			accelerator?: string;
			enabled?: boolean;
	  };

export const APP_NAVIGATION_BAR_BUTTON_ICONS = [
	'panel-left',
	'panel-right',
	'plus',
	'settings',
	'search',
	'refresh',
	'more-horizontal',
] as const;

export type AppNavigationBarButtonIcon =
	(typeof APP_NAVIGATION_BAR_BUTTON_ICONS)[number];

export interface AppNavigationBarButton {
	id: string;
	label: string;
	icon: AppNavigationBarButtonIcon;
	disabled?: boolean;
	expanded?: boolean;
	pressed?: boolean;
}

export interface AppNavigationBarOptions {
	title?: string;
	leftButtons?: AppNavigationBarButton[];
	rightButtons?: AppNavigationBarButton[];
	sidebarOpen?: boolean;
	sidebarTransitionStartedAt?: number;
	sidebarWidth?: number | null;
}
