import { webUtils } from 'electron';
import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import { AppChannels } from '../shared/ipc_channels_definitions';
import type { AppApi } from './index.d';
import type { AppThemeData } from '../shared/app_types';
import type { ChannelModelKind, ChannelStatusEvent, ChannelType } from '../shared';
import { optionalTrimmedString } from './normalize';
import type { AppStoreValue } from '../shared/app_store_types';

export const app: AppApi = {
	getAppStoreValue: <T extends AppStoreValue = AppStoreValue>(
		key: string
	): Promise<T | undefined> => {
		return typedInvokeUnwrap(AppChannels.getAppStoreValue, key) as Promise<T | undefined>;
	},
	setAppStoreValue: (key, value) => {
		return typedInvokeUnwrap(AppChannels.setAppStoreValue, key, value);
	},
	deleteAppStoreValue: (key) => {
		return typedInvokeUnwrap(AppChannels.deleteAppStoreValue, key);
	},
	readAppStoreFile: (path) => {
		return typedInvokeUnwrap(AppChannels.readAppStoreFile, path);
	},
	writeAppStoreFile: (path, data) => {
		return typedInvokeUnwrap(AppChannels.writeAppStoreFile, path, data);
	},
	deleteAppStoreFile: (path) => {
		return typedInvokeUnwrap(AppChannels.deleteAppStoreFile, path);
	},
	models: () => {
		return typedInvokeUnwrap(AppChannels.models);
	},
	databases: () => {
		return typedInvokeUnwrap(AppChannels.databases);
	},
	webSearches: () => {
		return typedInvokeUnwrap(AppChannels.webSearches);
	},
	mcps: () => {
		return typedInvokeUnwrap(AppChannels.mcps);
	},
	channels: () => {
		return typedInvokeUnwrap(AppChannels.channels);
	},
	getChannelsModelSelection: (kind: ChannelModelKind) => {
		return typedInvokeUnwrap(AppChannels.getChannelModelSelection, kind);
	},
	setChannelsModelSelection: (kind: ChannelModelKind, providerId: string, modelId: string) => {
		const normalizedProviderId = optionalTrimmedString(providerId);
		const normalizedModelId = optionalTrimmedString(modelId);
		return typedInvokeUnwrap(
			AppChannels.setChannelModelSelection,
			kind,
			normalizedProviderId ?? '',
			normalizedModelId ?? ''
		);
	},
	onModelsChanged: (callback: () => void): (() => void) => {
		return typedOn(AppChannels.modelsChanged, callback);
	},
	getPathForFile: (file: File): string => {
		return webUtils.getPathForFile(file);
	},
	openAppDataFolder: (): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.openAppDataFolder);
	},
	openDataFolder: (): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.openDataFolder);
	},
	openProvidersFolder: (): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.openProvidersFolder);
	},
	openExternalUrl: (url: string): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.openExternalUrl, url);
	},
	unfurlUrl: (url: string) => {
		return typedInvokeUnwrap(AppChannels.unfurlUrl, url);
	},
	setTrayEnabled: (enabled: boolean): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.setTrayEnabled, enabled);
	},
	getTrayEnabled: (): Promise<boolean> => {
		return typedInvokeUnwrap(AppChannels.getTrayEnabled);
	},
	setTrayClickAction: (action) => {
		return typedInvokeUnwrap(AppChannels.setTrayClickAction, action);
	},
	getTrayClickAction: () => {
		return typedInvokeUnwrap(AppChannels.getTrayClickAction);
	},
	getLaunchState: () => {
		return typedInvokeUnwrap(AppChannels.getLaunchState);
	},
	onTrayEnabledChanged: (callback: (enabled: boolean) => void): (() => void) => {
		return typedOn(AppChannels.trayEnabledChanged, callback);
	},
	setKeepAwake: (enabled: boolean): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.setKeepAwake, enabled);
	},
	getKeepAwake: (): Promise<boolean> => {
		return typedInvokeUnwrap(AppChannels.getKeepAwake);
	},
	onKeepAwakeChanged: (callback: (enabled: boolean) => void): (() => void) => {
		return typedOn(AppChannels.keepAwakeChanged, callback);
	},
	setLanguage: (language) => {
		return typedInvokeUnwrap(AppChannels.setLanguage, language);
	},
	getLanguage: () => {
		return typedInvokeUnwrap(AppChannels.getLanguage);
	},
	setTheme: (theme) => {
		return typedInvokeUnwrap(AppChannels.setTheme, theme);
	},
	getTheme: () => {
		return typedInvokeUnwrap(AppChannels.getTheme);
	},
	getThemeData: () => {
		return typedInvokeUnwrap(AppChannels.getThemeData);
	},
	getSandboxStatus: () => {
		return typedInvokeUnwrap(AppChannels.getSandboxStatus);
	},
	setupSandbox: () => {
		return typedInvokeUnwrap(AppChannels.setupSandbox);
	},
	onThemeModeChanged: (callback: (theme: AppThemeData) => void): (() => void) => {
		return typedOn(AppChannels.themeModeChanged, callback);
	},
	getMicrophoneInputId: () => {
		return typedInvokeUnwrap(AppChannels.getMicrophoneInputId);
	},
	setMicrophoneInputId: (inputId) => {
		return typedInvokeUnwrap(AppChannels.setMicrophoneInputId, inputId);
	},
	getMicrophonePermission: () => {
		return typedInvokeUnwrap(AppChannels.getMicrophonePermission);
	},
	setMicrophoneEnabled: (enabled: boolean) => {
		return typedInvokeUnwrap(AppChannels.setMicrophoneEnabled, enabled);
	},
	requestMicrophonePermission: () => {
		return typedInvokeUnwrap(AppChannels.requestMicrophonePermission);
	},
	openSystemPreference: (pane) => {
		return typedInvokeUnwrap(AppChannels.openSystemPreference, pane);
	},
	getCameraPermission: () => {
		return typedInvokeUnwrap(AppChannels.getCameraPermission);
	},
	setCameraEnabled: (enabled: boolean) => {
		return typedInvokeUnwrap(AppChannels.setCameraEnabled, enabled);
	},
	requestCameraPermission: () => {
		return typedInvokeUnwrap(AppChannels.requestCameraPermission);
	},
	getScreenCapturePermission: () => {
		return typedInvokeUnwrap(AppChannels.getScreenCapturePermission);
	},
	requestScreenCapturePermission: () => {
		return typedInvokeUnwrap(AppChannels.requestScreenCapturePermission);
	},
	openVideo: (path: string): Promise<void> => {
		const normalizedPath = optionalTrimmedString(path);
		if (!normalizedPath) throw new Error('Invalid video path.');
		return typedInvokeUnwrap(AppChannels.openVideo, normalizedPath);
	},
	showImageContextMenu: (path: string): Promise<void> => {
		const normalizedPath = optionalTrimmedString(path);
		if (!normalizedPath) throw new Error('Invalid image path.');
		return typedInvokeUnwrap(AppChannels.showImageContextMenu, normalizedPath);
	},
	showVideoContextMenu: (path: string): Promise<void> => {
		const normalizedPath = optionalTrimmedString(path);
		if (!normalizedPath) throw new Error('Invalid video path.');
		return typedInvokeUnwrap(AppChannels.showVideoContextMenu, normalizedPath);
	},
	showAudioContextMenu: (path: string): Promise<void> => {
		const normalizedPath = optionalTrimmedString(path);
		if (!normalizedPath) throw new Error('Invalid audio path.');
		return typedInvokeUnwrap(AppChannels.showAudioContextMenu, normalizedPath);
	},
	uploadProvider: (): Promise<string | null> => {
		return typedInvokeUnwrap(AppChannels.uploadProvider);
	},
	getChannelsStatus: (type?: ChannelType): Promise<ChannelStatusEvent | undefined> => {
		return typedInvokeUnwrap(AppChannels.getChannelsStatus, type);
	},
	startTelegram: (): Promise<ChannelStatusEvent | undefined> => {
		return typedInvokeUnwrap(AppChannels.startTelegram);
	},
	stopTelegram: (): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.stopTelegram);
	},
	restartTelegram: (): Promise<ChannelStatusEvent | undefined> => {
		return typedInvokeUnwrap(AppChannels.restartTelegram);
	},
	onChannelsStatusChanged: (callback: (event: ChannelStatusEvent) => void): (() => void) => {
		return typedOn(AppChannels.channelsStatusChanged, callback);
	},
};
