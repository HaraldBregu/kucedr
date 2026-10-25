export const APP_WINDOW_TYPES = ['normal', 'panel', 'toolbar'] as const;
export const APP_TITLE_BAR_STYLES = ['hidden', 'hiddenInset', 'default'] as const;

export type AppWindowSettings = {
	width?: number;
	height?: number;
	minWidth?: number;
	minHeight?: number;
	resizable?: boolean;
	maximizable?: boolean;
	frame?: boolean;
	transparent?: boolean;
	alwaysOnTop?: boolean;
	type?: (typeof APP_WINDOW_TYPES)[number];
	titleBarStyle?: (typeof APP_TITLE_BAR_STYLES)[number];
};

export type ResolvedAppWindowSettings = Required<AppWindowSettings>;

export const APP_WINDOW_DEFAULTS: Readonly<ResolvedAppWindowSettings> = {
	width: 820,
	height: 640,
	minWidth: 620,
	minHeight: 480,
	resizable: true,
	maximizable: true,
	frame: true,
	transparent: true,
	alwaysOnTop: false,
	type: 'normal',
	titleBarStyle: 'default',
};
