import { webUtils } from 'electron';
import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import { AppChannels } from '../shared/ipc_channels_definitions';
import type { AppApi } from './index.d';
import type { AppThemeData } from '../shared/app_types';
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
	vectorDatabases: () => {
		return typedInvokeUnwrap(AppChannels.vectorDatabases);
	},
	storages: () => {
		return typedInvokeUnwrap(AppChannels.storages);
	},
	mcps: () => {
		return typedInvokeUnwrap(AppChannels.mcps);
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
	getActivity: () => {
		return typedInvokeUnwrap(AppChannels.getActivity);
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
	getAvailableUpdate: () => {
		return typedInvokeUnwrap(AppChannels.getAvailableUpdate);
	},
	installUpdate: () => {
		return typedInvokeUnwrap(AppChannels.installUpdate);
	},
	onUpdateAvailable: (callback: (version: string) => void): (() => void) => {
		return typedOn(AppChannels.updateAvailable, callback);
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
	setSoundFeedbackEnabled: (enabled: boolean): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.setSoundFeedbackEnabled, enabled);
	},
	getSoundFeedbackEnabled: (): Promise<boolean> => {
		return typedInvokeUnwrap(AppChannels.getSoundFeedbackEnabled);
	},
	onSoundFeedbackEnabledChanged: (callback: (enabled: boolean) => void): (() => void) => {
		return typedOn(AppChannels.soundFeedbackEnabledChanged, callback);
	},
	setChatTextSize: (size) => typedInvokeUnwrap(AppChannels.setChatTextSize, size),
	getChatTextSize: () => typedInvokeUnwrap(AppChannels.getChatTextSize),
	onChatTextSizeChanged: (callback) => typedOn(AppChannels.chatTextSizeChanged, callback),
	setZoomFactor: (factor) => typedInvokeUnwrap(AppChannels.setZoomFactor, factor),
	getZoomFactor: () => typedInvokeUnwrap(AppChannels.getZoomFactor),
	onZoomFactorChanged: (callback) => typedOn(AppChannels.zoomFactorChanged, callback),
	getWorkspaceImageModel: () => typedInvokeUnwrap(AppChannels.getWorkspaceImageModel),
	setWorkspaceImageModel: (model) => typedInvokeUnwrap(AppChannels.setWorkspaceImageModel, model),
	getWorkspaceVoiceModel: () => typedInvokeUnwrap(AppChannels.getWorkspaceVoiceModel),
	setWorkspaceVoiceModel: (model) => typedInvokeUnwrap(AppChannels.setWorkspaceVoiceModel, model),
	getWorkspaceModelOptions: () => typedInvokeUnwrap(AppChannels.getWorkspaceModelOptions),
	setWorkspaceModelOption: (option) => typedInvokeUnwrap(AppChannels.setWorkspaceModelOption, option),
	getWorkspaceModel: () => typedInvokeUnwrap(AppChannels.getWorkspaceModel),
	setWorkspaceModel: (model) => typedInvokeUnwrap(AppChannels.setWorkspaceModel, model),
	setWorkspaceWideContent: (enabled: boolean): Promise<void> => {
		return typedInvokeUnwrap(AppChannels.setWorkspaceWideContent, enabled);
	},
	exportDocument: (name, format, content) => typedInvokeUnwrap(AppChannels.exportDocument, name, format, content),
	getWorkspaceWideContent: (): Promise<boolean> => {
		return typedInvokeUnwrap(AppChannels.getWorkspaceWideContent);
	},
	setWorkspaceTextSize: (size) => {
		return typedInvokeUnwrap(AppChannels.setWorkspaceTextSize, size);
	},
	getWorkspaceTextSize: () => {
		return typedInvokeUnwrap(AppChannels.getWorkspaceTextSize);
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
	getVoiceAgentAppearance: () => {
		return typedInvokeUnwrap(AppChannels.getVoiceAgentAppearance);
	},
	setVoiceAgentAppearance: (appearance) => {
		return typedInvokeUnwrap(AppChannels.setVoiceAgentAppearance, appearance);
	},
	onVoiceAgentAppearanceChanged: (callback) => {
		return typedOn(AppChannels.voiceAgentAppearanceChanged, callback);
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
};
