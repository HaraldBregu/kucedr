import type { BrowserWindow } from 'electron';
import type { ResolvedAppWindowSettings } from '../../shared/app_window_settings';
import { writeAppWindowSettings } from './app_write';

export function persistWorkspaceWindowSize(
	window: Pick<BrowserWindow, 'getNormalBounds'>,
	settings: ResolvedAppWindowSettings
): void {
	const { width, height } = window.getNormalBounds();
	writeAppWindowSettings('workspace', { ...settings, width, height });
}
