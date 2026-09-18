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

export const APP_NAVIGATIONBAR_BUTTON_ICONS = [
	'panel-left',
	'panel-right',
	'plus',
	'settings',
	'search',
	'refresh',
	'more-horizontal',
] as const;

export type AppNavigationbarButtonIcon =
	(typeof APP_NAVIGATIONBAR_BUTTON_ICONS)[number];

export interface AppNavigationbarButton {
	id: string;
	label: string;
	icon: AppNavigationbarButtonIcon;
	disabled?: boolean;
	expanded?: boolean;
	pressed?: boolean;
}

export interface AppNavigationbarOptions {
	title?: string;
	leftButtons?: AppNavigationbarButton[];
	rightButtons?: AppNavigationbarButton[];
	sidebarOpen?: boolean;
	sidebarTransitionStartedAt?: number;
	sidebarWidth?: number | null;
}
