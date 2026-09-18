import { typedInvokeUnwrap, typedSend, typedOn } from '../shared/ipc_types';
import { WindowChannels } from '../shared/ipc_channels_definitions';
import type { WindowApi } from './index.d';

let navigationBarSidebarOpen: boolean | undefined;
let navigationBarSidebarTransitionStartedAt: number | undefined;

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
	confirmSignOut: (): Promise<boolean> => typedInvokeUnwrap(WindowChannels.confirmSignOut),
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
	setNavigationBarOptions: (options): void => {
		if (options === null) {
			navigationBarSidebarOpen = undefined;
			navigationBarSidebarTransitionStartedAt = undefined;
			typedSend(WindowChannels.navigationBarOptionsSet, options);
			return;
		}
		const sidebarChanged =
			navigationBarSidebarOpen !== undefined &&
			options.sidebarOpen !== undefined &&
			navigationBarSidebarOpen !== options.sidebarOpen;
		navigationBarSidebarOpen = options.sidebarOpen;
		if (sidebarChanged) navigationBarSidebarTransitionStartedAt = Date.now();
		const transitionStartedAt =
			navigationBarSidebarTransitionStartedAt !== undefined &&
			Date.now() - navigationBarSidebarTransitionStartedAt <= 200
				? navigationBarSidebarTransitionStartedAt
				: undefined;
		typedSend(
			WindowChannels.navigationBarOptionsSet,
			transitionStartedAt === undefined
				? options
				: { ...options, sidebarTransitionStartedAt: transitionStartedAt }
		);
	},
	onNavigationBarOptionsChanged: (callback): (() => void) => {
		return typedOn(WindowChannels.navigationBarOptionsChanged, callback);
	},
	clickNavigationBarButton: (buttonId): void => {
		typedSend(WindowChannels.navigationBarButtonClick, buttonId);
	},
	onNavigationBarButtonClick: (callback): (() => void) => {
		return typedOn(WindowChannels.navigationBarButtonClicked, callback);
	},
	setNavigationBarSidebarWidth: (width: number | null): void => {
		typedSend(WindowChannels.navigationBarSidebarWidthSet, width);
	},
	onNavigationBarSidebarWidthChanged: (callback: (width: number | null) => void): (() => void) => {
		return typedOn(WindowChannels.navigationBarSidebarWidthChanged, callback);
	},
} satisfies WindowApi;
