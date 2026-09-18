import {
	APP_TITLEBAR_BUTTON_ICONS,
	type AppTitlebarButton,
	type AppTitlebarOptions,
} from './window_types';

const icons = new Set<string>(APP_TITLEBAR_BUTTON_ICONS);
const maxButtonsPerSide = 6;
const maxTextLength = 120;

export function isAppTitlebarOptions(
	value: unknown
): value is AppTitlebarOptions | null {
	if (value === null) return true;
	if (typeof value !== 'object' || Array.isArray(value)) return false;
	const options = value as Record<string, unknown>;
	if (
		options.title !== undefined &&
		(typeof options.title !== 'string' ||
			!options.title.trim() ||
			options.title.length > maxTextLength)
	) {
		return false;
	}
	if (
		options.sidebarWidth !== undefined &&
		options.sidebarWidth !== null &&
		(typeof options.sidebarWidth !== 'number' ||
			!Number.isFinite(options.sidebarWidth) ||
			options.sidebarWidth < 0 ||
			options.sidebarWidth > 800)
	) {
		return false;
	}
	if (options.sidebarOpen !== undefined && typeof options.sidebarOpen !== 'boolean') return false;
	if (
		options.sidebarTransitionStartedAt !== undefined &&
		(typeof options.sidebarTransitionStartedAt !== 'number' ||
			!Number.isSafeInteger(options.sidebarTransitionStartedAt) ||
			options.sidebarTransitionStartedAt < 0)
	) {
		return false;
	}
	const ids = new Set<string>();
	for (const side of ['leftButtons', 'rightButtons'] as const) {
		const buttons = options[side];
		if (buttons === undefined) continue;
		if (!Array.isArray(buttons) || buttons.length > maxButtonsPerSide) return false;
		for (const value of buttons) {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
			const button = value as Partial<AppTitlebarButton>;
			if (
				typeof button.id !== 'string' ||
				!button.id.trim() ||
				button.id.length > maxTextLength ||
				ids.has(button.id) ||
				typeof button.label !== 'string' ||
				!button.label.trim() ||
				button.label.length > maxTextLength ||
				typeof button.icon !== 'string' ||
				!icons.has(button.icon) ||
				(button.disabled !== undefined && typeof button.disabled !== 'boolean') ||
				(button.expanded !== undefined && typeof button.expanded !== 'boolean') ||
				(button.pressed !== undefined && typeof button.pressed !== 'boolean')
			) {
				return false;
			}
			ids.add(button.id);
		}
	}
	return true;
}
