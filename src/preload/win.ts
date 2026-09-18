import { typedInvokeUnwrap, typedSend, typedOn } from '../shared/ipc_types';
import { WindowChannels } from '../shared/ipc_channels_definitions';
import type { WindowApi } from './index.d';

let navigationbarSidebarOpen: boolean | undefined;
let navigationbarSidebarTransitionStartedAt: number | undefined;

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
	setNavigationbarOptions: (options): void => {
		if (options === null) {
			navigationbarSidebarOpen = undefined;
			navigationbarSidebarTransitionStartedAt = undefined;
			typedSend(WindowChannels.navigationbarOptionsSet, options);
			return;
		}
		const sidebarChanged =
			navigationbarSidebarOpen !== undefined &&
			options.sidebarOpen !== undefined &&
			navigationbarSidebarOpen !== options.sidebarOpen;
		navigationbarSidebarOpen = options.sidebarOpen;
		if (sidebarChanged) navigationbarSidebarTransitionStartedAt = Date.now();
		const transitionStartedAt =
			navigationbarSidebarTransitionStartedAt !== undefined &&
			Date.now() - navigationbarSidebarTransitionStartedAt <= 200
				? navigationbarSidebarTransitionStartedAt
				: undefined;
		typedSend(
			WindowChannels.navigationbarOptionsSet,
			transitionStartedAt === undefined
				? options
				: { ...options, sidebarTransitionStartedAt: transitionStartedAt }
		);
	},
	onNavigationbarOptionsChanged: (callback): (() => void) => {
		return typedOn(WindowChannels.navigationbarOptionsChanged, callback);
	},
	clickNavigationbarButton: (buttonId): void => {
		typedSend(WindowChannels.navigationbarButtonClick, buttonId);
	},
	onNavigationbarButtonClick: (callback): (() => void) => {
		return typedOn(WindowChannels.navigationbarButtonClicked, callback);
	},
	setNavigationbarSidebarWidth: (width: number | null): void => {
		typedSend(WindowChannels.navigationbarSidebarWidthSet, width);
	},
	onNavigationbarSidebarWidthChanged: (callback: (width: number | null) => void): (() => void) => {
		return typedOn(WindowChannels.navigationbarSidebarWidthChanged, callback);
	},
} satisfies WindowApi;
