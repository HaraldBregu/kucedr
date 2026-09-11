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

export const APP_TITLEBAR_BUTTON_ICONS = [
	'panel-left',
	'panel-right',
	'plus',
	'settings',
	'search',
	'refresh',
	'more-horizontal',
] as const;

export type AppTitlebarButtonIcon =
	(typeof APP_TITLEBAR_BUTTON_ICONS)[number];

export interface AppTitlebarButton {
	id: string;
	label: string;
	icon: AppTitlebarButtonIcon;
	disabled?: boolean;
	expanded?: boolean;
	pressed?: boolean;
}

export interface AppTitlebarOptions {
	title?: string;
	leftButtons?: AppTitlebarButton[];
	rightButtons?: AppTitlebarButton[];
	sidebarOpen?: boolean;
	sidebarTransitionStartedAt?: number;
	sidebarWidth?: number | null;
}
