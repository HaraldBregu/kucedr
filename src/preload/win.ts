import { typedInvokeUnwrap, typedSend, typedOn } from '../shared/ipc_types';
import { WindowChannels } from '../shared/ipc_channels_definitions';
import type { WindowApi } from './index.d';

let titlebarSidebarOpen: boolean | undefined;
let titlebarSidebarTransitionStartedAt: number | undefined;

export const win: WindowApi = {
	minimize: (): void => {
		typedSend(WindowChannels.minimize);
	},
	maximize: (): void => {
		typedSend(WindowChannels.maximize);
	},
	close: (): void => {
		typedSend(WindowChannels.close);
	},
	openVoiceConversation: (chatSessionId): Promise<void> => {
		const normalizedChatSessionId = chatSessionId.trim();
		if (!normalizedChatSessionId) throw new Error('Invalid voice conversation session id.');
		return typedInvokeUnwrap(WindowChannels.openVoiceConversation, normalizedChatSessionId);
	},
	popupMenu: (): void => {
		typedSend(WindowChannels.popupMenu);
	},
	showContextMenu: (items) => {
		return typedInvokeUnwrap(WindowChannels.showContextMenu, items);
	},
	isMaximized: (): Promise<boolean> => {
		return typedInvokeUnwrap(WindowChannels.isMaximized);
	},
	onMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
		return typedOn(WindowChannels.maximizeChange, callback);
	},
	isFullScreen: (): Promise<boolean> => {
		return typedInvokeUnwrap(WindowChannels.isFullScreen);
	},
	onFullScreenChange: (callback: (isFullScreen: boolean) => void): (() => void) => {
		return typedOn(WindowChannels.fullScreenChange, callback);
	},
	setTitlebarOptions: (options): void => {
		if (options === null) {
			titlebarSidebarOpen = undefined;
			titlebarSidebarTransitionStartedAt = undefined;
			typedSend(WindowChannels.titlebarOptionsSet, options);
			return;
		}
		const sidebarChanged =
			titlebarSidebarOpen !== undefined &&
			options.sidebarOpen !== undefined &&
			titlebarSidebarOpen !== options.sidebarOpen;
		titlebarSidebarOpen = options.sidebarOpen;
		if (sidebarChanged) titlebarSidebarTransitionStartedAt = Date.now();
		const transitionStartedAt =
			titlebarSidebarTransitionStartedAt !== undefined &&
			Date.now() - titlebarSidebarTransitionStartedAt <= 200
				? titlebarSidebarTransitionStartedAt
				: undefined;
		typedSend(
			WindowChannels.titlebarOptionsSet,
			transitionStartedAt === undefined
				? options
				: { ...options, sidebarTransitionStartedAt: transitionStartedAt }
		);
	},
	getTitlebarOptions: (): Promise<import('../shared/window_types').AppTitlebarOptions | null> => {
		return typedInvokeUnwrap(WindowChannels.titlebarOptionsGet);
	},
	onTitlebarOptionsChanged: (callback): (() => void) => {
		return typedOn(WindowChannels.titlebarOptionsChanged, callback);
	},
	clickTitlebarButton: (buttonId): void => {
		typedSend(WindowChannels.titlebarButtonClick, buttonId);
	},
	onTitlebarButtonClick: (callback): (() => void) => {
		return typedOn(WindowChannels.titlebarButtonClicked, callback);
	},
	setTitlebarSidebarWidth: (width: number | null): void => {
		typedSend(WindowChannels.titlebarSidebarWidthSet, width);
	},
	onTitlebarSidebarWidthChanged: (callback: (width: number | null) => void): (() => void) => {
		return typedOn(WindowChannels.titlebarSidebarWidthChanged, callback);
	},
} satisfies WindowApi;
