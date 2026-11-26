import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
	AudioWaveform,
	Bell,
	ChevronRight,
	CircleHelp,
	Coffee,
	FileText,
	FolderOpen,
	Keyboard,
	Languages,
	Lock,
	MousePointerClick,
	PanelTop,
	Scale,
	ScrollText,
	ShieldCheck,
	SunMoon,
	Type,
	Volume2,
	AppWindow,
	Layers,
	ZoomIn,
} from 'lucide-react';
import { WINDOW_SIZES, type WindowSize } from '../../../../../../shared/window_size';
import type { PluginTheme } from '@shared/plugin_types';
import {
	UPDATE_CHANNELS,
	ZOOM_FACTORS,
	type UpdateChannel,
	type ZoomFactor,
} from '../../../../../../shared/app_types';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CHAT_TEXT_SIZES, useApp, type AppLanguage, type ChatTextSize } from '@/contexts';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { MediaPermissionsSection } from '../../components/media';
import { ThemePicker } from '../../components/theme';

interface LanguageOption {
	readonly value: AppLanguage;
	readonly labelKey: string;
}

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
	{ value: 'en', labelKey: 'settings.language.en' },
	{ value: 'it', labelKey: 'settings.language.it' },
] as const;

const TRAY_CLICK_ACTION_OPTIONS = [
	{ value: 'toggle-chat', labelKey: 'settings.application.trayClickAction.chat' },
	{ value: 'toggle-persona', labelKey: 'settings.application.trayClickAction.voiceAgent' },
] as const;

type TrayClickAction = (typeof TRAY_CLICK_ACTION_OPTIONS)[number]['value'];

const LEGAL_LINKS = [
	{ url: __APP_LINKS__.terms, titleKey: 'settings.application.termsOfService', icon: FileText },
	{ url: __APP_LINKS__.privacy, titleKey: 'settings.application.privacyPolicy', icon: Lock },
	{ url: __APP_LINKS__.license, titleKey: 'settings.application.license', icon: Scale },
	{ url: __APP_LINKS__.notices, titleKey: 'settings.application.thirdPartyNotices', icon: ScrollText },
	{ url: __APP_LINKS__.security, titleKey: 'settings.application.securityPolicy', icon: ShieldCheck },
];

const GeneralPage: React.FC = () => {
	const { t } = useTranslation();
	const {
		language,
		setLanguage,
		theme,
		setTheme,
		soundFeedbackEnabled,
		setSoundFeedbackEnabled,
		chatTextSize,
		setChatTextSize,
	} = useApp();
	const [themes, setThemes] = useState<PluginTheme[]>([]);
	const [selectedTheme, setSelectedTheme] = useState<{ pluginId: string; themeId: string } | null>(
		null
	);
	const [trayEnabled, setTrayEnabled] = useState(true);
	const [trayClickAction, setTrayClickAction] = useState<TrayClickAction>('toggle-chat');
	const [keepAwake, setKeepAwake] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(true);
	const [updateChannel, setUpdateChannel] = useState<UpdateChannel>('stable');
	const [windowSize, setWindowSize] = useState<WindowSize>('1200x800');
	const [zoomFactor, setZoomFactor] = useState<ZoomFactor>(1);
	const [sidebarTranslucency, setSidebarTranslucency] = useState<boolean | null>(null);
	const activeTheme = themes.find(
		(item) =>
			item.enabled &&
			item.plugin.id === selectedTheme?.pluginId &&
			item.id === selectedTheme.themeId
	);

	useEffect(() => {
		let active = true;
		const loadThemes = (): void => {
			void Promise.all([window.app.themes(), window.app.getSelectedTheme()]).then(
				([items, selection]) => {
					if (active) {
						setThemes(items);
						setSelectedTheme(selection);
					}
				}
			);
		};
		loadThemes();
		const offThemes = window.app.onThemesChanged(loadThemes);
		void window.app.getSidebarTranslucency().then((enabled) => {
			if (active) setSidebarTranslucency(enabled);
		});
		const offTranslucency = window.app.onThemeModeChanged((data) => {
			setSidebarTranslucency(data.colors['sidebar-translucency-opacity'] !== '1');
		});
		void window.app.getTrayEnabled().then(setTrayEnabled);
		void window.app.getTrayClickAction().then(setTrayClickAction);
		void window.app.getKeepAwake().then(setKeepAwake);
		void window.app.getNotificationsEnabled().then(setNotificationsEnabled);
		void window.app.getUpdateChannel().then(setUpdateChannel);
		void window.app.getZoomFactor().then(setZoomFactor);
		void window.win.getSize().then(setWindowSize);
		const offTrayEnabled = window.app.onTrayEnabledChanged(setTrayEnabled);
		const offKeepAwake = window.app.onKeepAwakeChanged(setKeepAwake);
		const offZoomFactor = window.app.onZoomFactorChanged(setZoomFactor);
		return () => {
			active = false;
			offThemes();
			offTranslucency();
			offTrayEnabled();
			offKeepAwake();
			offZoomFactor();
		};
	}, []);

	const handleTrayToggle = useCallback((checked: boolean) => {
		setTrayEnabled(checked);
		void window.app.setTrayEnabled(checked);
	}, []);

	const handleKeepAwakeToggle = useCallback((checked: boolean) => {
		setKeepAwake(checked);
		void window.app.setKeepAwake(checked).catch(() => setKeepAwake(!checked));
	}, []);

	const handleNotificationsToggle = useCallback((checked: boolean) => {
		setNotificationsEnabled(checked);
		void window.app
			.setNotificationsEnabled(checked)
			.catch(() => setNotificationsEnabled(!checked));
	}, []);

	const handleTrayClickActionChange = (next: string | null): void => {
		if (next === null) return;
		const option = TRAY_CLICK_ACTION_OPTIONS.find((item) => item.value === next);
		if (!option) return;
		setTrayClickAction(option.value);
		void window.app.setTrayClickAction(option.value);
	};

	const handleUpdateChannelChange = (next: string | null): void => {
		const channel = UPDATE_CHANNELS.find((item) => item === next);
		if (!channel) return;
		const previous = updateChannel;
		setUpdateChannel(channel);
		void window.app.setUpdateChannel(channel).catch(() => setUpdateChannel(previous));
	};

	const handleOpenAppDataFolder = useCallback(() => {
		void window.app.openAppDataFolder();
	}, []);

	const handleOpenDataFolder = useCallback(() => {
		void window.app.openDataFolder();
	}, []);

	const handleLanguageChange = (next: string | null): void => {
		if (next === null) return;
		const option = LANGUAGE_OPTIONS.find((o) => o.value === next);
		if (option) setLanguage(option.value);
	};

	const handleChatTextSizeChange = (next: string | null): void => {
		if (next && Object.hasOwn(CHAT_TEXT_SIZES, next)) setChatTextSize(next as ChatTextSize);
	};

	const handleZoomFactorChange = (next: ZoomFactor | null): void => {
		if (next === null) return;
		setZoomFactor(next);
		void window.app.setZoomFactor(next);
	};

	const handleWindowSizeChange = (next: string | null): void => {
		if (!next || !Object.hasOwn(WINDOW_SIZES, next)) return;
		const size = next as WindowSize;
		const previous = windowSize;
		setWindowSize(size);
		void window.win.setSize(size).catch(() => setWindowSize(previous));
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.general')}
				description={t('settings.tabs.generalDescription')}
			/>

			<SettingsSection title={t('settings.application.information')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.application.name')}
						description={t('settings.application.nameDescription')}
						actionClassName="w-auto justify-end"
						actions={<span className="text-13 text-foreground">{__APP_NAME__}</span>}
					/>
					<SettingsRow
						title={t('settings.application.version')}
						description={t('settings.application.versionDescription')}
						actionClassName="w-auto justify-end"
						actions={
							<span className="font-mono text-13 text-foreground">{__APP_VERSION__}</span>
						}
					/>
					<SettingsRow
						title={t('settings.application.updates.title')}
						description={t('settings.application.updates.description')}
						actionClassName="w-auto justify-end"
						actions={
							<Select value={updateChannel} onValueChange={handleUpdateChannelChange}>
								<SelectTrigger
									size="sm"
									className="w-28 text-xs [&_svg]:size-3"
									aria-label={t('settings.application.updates.title')}
								>
									<SelectValue>{t(`settings.application.updates.${updateChannel}`)}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{UPDATE_CHANNELS.map((channel) => (
										<SelectItem key={channel} value={channel}>
											{t(`settings.application.updates.${channel}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
					{LEGAL_LINKS.map((link) => (
						<button
							key={link.url}
							type="button"
							className="block w-full text-left hover:bg-muted/40"
							onClick={() => void window.app.openExternalUrl(link.url)}
						>
							<SettingsRow
								title={t(link.titleKey)}
								media={<link.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
								className="grid-cols-[minmax(0,1fr)_auto]"
								actionClassName="w-auto justify-end"
								actions={<ChevronRight className="size-4 text-muted-foreground" />}
							/>
						</button>
					))}
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.application.actions')}>
				<SettingsPanel>
					<SettingsRow
						id="settings-sound"
						title={t('settings.application.soundFeedback')}
						description={t('settings.application.soundFeedbackDescription')}
						media={<Volume2 className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={
							<Switch
								checked={soundFeedbackEnabled}
								onCheckedChange={setSoundFeedbackEnabled}
								aria-label={t('settings.application.soundFeedback')}
							/>
						}
					/>
					<SettingsRow
						id="settings-notifications"
						title={t('settings.application.runNotifications')}
						description={t('settings.application.runNotificationsDescription')}
						media={<Bell className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={
							<Switch
								checked={notificationsEnabled}
								onCheckedChange={handleNotificationsToggle}
								aria-label={t('settings.application.runNotifications')}
							/>
						}
					/>
					<SettingsRow
						title={t('settings.application.menuBar')}
						id="settings-menu-bar"
						description={t('settings.application.menuBarDescription')}
						media={
							<PanelTop className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						actionClassName="w-auto justify-end"
						actions={
							<Switch
								checked={trayEnabled}
								onCheckedChange={handleTrayToggle}
								aria-label={t('settings.application.menuBar')}
							/>
						}
					/>
					<SettingsRow
						title={t('settings.application.trayClickAction.title')}
						description={t('settings.application.trayClickAction.description')}
						media={
							<MousePointerClick
								className="size-5 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
						}
						actionClassName="w-auto justify-end"
						actions={
							<Select value={trayClickAction} onValueChange={handleTrayClickActionChange}>
								<SelectTrigger
									size="sm"
									className="w-28 text-xs [&_svg]:size-3"
									aria-label={t('settings.application.trayClickAction.title')}
								>
									<SelectValue>
										{t(
											TRAY_CLICK_ACTION_OPTIONS.find((item) => item.value === trayClickAction)
												?.labelKey ?? ''
										)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{TRAY_CLICK_ACTION_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{t(option.labelKey)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
					<SettingsRow
						title={t('settings.application.keepAwake')}
						description={t('settings.application.keepAwakeDescription')}
						media={<Coffee className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={
							<Switch
								checked={keepAwake}
								onCheckedChange={handleKeepAwakeToggle}
								aria-label={t('settings.application.keepAwake')}
							/>
						}
					/>
					<button
						type="button"
						className="block w-full text-left hover:bg-muted/40"
						onClick={() => void window.app.openExternalUrl('https://www.kucedr.com/help')}
					>
						<SettingsRow
							title={t('settings.sidebar.getHelp')}
							media={
								<CircleHelp className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
							}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="w-auto justify-end"
							actions={<ChevronRight className="size-4 text-muted-foreground" />}
						/>
					</button>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.sections.layout')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.application.windowSize')}
						description={t('settings.application.windowSizeDescription')}
						media={
							<AppWindow className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						actionClassName="w-auto justify-end"
						actions={
							<Select value={windowSize} onValueChange={handleWindowSizeChange}>
								<SelectTrigger
									size="sm"
									className="w-28 text-xs [&_svg]:size-3"
									aria-label={t('settings.application.windowSize')}
								>
									<SelectValue>{windowSize.replace('x', '×')}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{Object.keys(WINDOW_SIZES).map((size) => (
										<SelectItem key={size} value={size}>
											{size.replace('x', '×')}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
					<Link to="/settings/general/shortcuts" className="block hover:bg-muted/40">
						<SettingsRow
							title={t('settings.shortcuts.title')}
							description={t('settings.shortcuts.description')}
							media={<Keyboard className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="w-auto justify-end"
							actions={<ChevronRight className="size-4 text-muted-foreground" />}
						/>
					</Link>
					<Link to="/settings/general/persona" className="block hover:bg-muted/40">
						<SettingsRow
							title={t('settings.voiceAgent.title')}
							description={t('settings.voiceAgent.description')}
							media={
								<AudioWaveform
									className="size-5 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
							}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="w-auto justify-end"
							actions={<ChevronRight className="size-4 text-muted-foreground" />}
						/>
					</Link>
					<SettingsRow
						id="settings-language"
						title={t('settings.language.title')}
						description={t('settings.language.description')}
						media={
							<Languages className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						actionClassName="w-auto justify-end"
						actions={
							<Select value={language} onValueChange={handleLanguageChange}>
								<SelectTrigger
									size="sm"
									className="w-24 text-xs [&_svg]:size-3"
									aria-label={t('settings.language.title')}
								>
									<SelectValue>
										{t(LANGUAGE_OPTIONS.find((o) => o.value === language)?.labelKey ?? '')}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{LANGUAGE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{t(option.labelKey)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
					<SettingsRow
						title={t('settings.application.interfaceSize.title')}
						id="settings-interface-size"
						description={t('settings.application.interfaceSize.description')}
						media={<ZoomIn className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={
							<Select value={zoomFactor} onValueChange={handleZoomFactorChange}>
								<SelectTrigger
									size="sm"
									className="w-28 text-xs [&_svg]:size-3"
									aria-label={t('settings.application.interfaceSize.title')}
								>
									<SelectValue>{`${Math.round(zoomFactor * 100)}%`}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{ZOOM_FACTORS.map((factor) => (
										<SelectItem key={factor} value={factor}>
											{`${Math.round(factor * 100)}%`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
					<SettingsRow
						title={t('settings.application.chatTextSize.title')}
						id="settings-chat-text-size"
						description={t('settings.application.chatTextSize.description')}
						media={<Type className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={
							<Select value={chatTextSize} onValueChange={handleChatTextSizeChange}>
								<SelectTrigger
									size="sm"
									className="w-28 text-xs [&_svg]:size-3"
									aria-label={t('settings.application.chatTextSize.title')}
								>
									<SelectValue>
										{t(`settings.application.chatTextSize.${chatTextSize}`)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{Object.keys(CHAT_TEXT_SIZES).map((size) => (
										<SelectItem key={size} value={size}>
											{t(`settings.application.chatTextSize.${size}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
					<SettingsRow
						id="settings-theme-appearance"
						title={t('settings.theme.appearance')}
						actionClassName="w-auto justify-end"
						actions={
							<Select
								value={activeTheme ? JSON.stringify(selectedTheme) : 'default'}
								onValueChange={(value) => {
									if (!value) return;
									const next =
										value === 'default'
											? null
											: (JSON.parse(value) as { pluginId: string; themeId: string });
									void window.app.setSelectedTheme(next).then(() => setSelectedTheme(next));
								}}
							>
								<SelectTrigger
									size="sm"
									className="w-48 text-xs"
									aria-label={t('settings.theme.appearance')}
								>
									<SelectValue>
										{activeTheme
											? `${activeTheme.title} · ${activeTheme.plugin.name}`
											: t('settings.theme.default')}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="default">{t('settings.theme.default')}</SelectItem>
									{themes
										.filter((item) => item.enabled)
										.map((item) => (
											<SelectItem
												key={JSON.stringify([item.plugin.id, item.id])}
												value={JSON.stringify({ pluginId: item.plugin.id, themeId: item.id })}
											>
												{item.title} · {item.plugin.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						}
					/>
					<SettingsRow
						id="settings-theme"
						title={t('settings.theme.title')}
						media={<SunMoon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={<ThemePicker value={theme} onChange={setTheme} />}
					/>
					{navigator.platform.startsWith('Mac') && (
						<SettingsRow
							title={t('settings.application.sidebarTranslucency')}
							description={t('settings.application.sidebarTranslucencyDescription')}
							media={<Layers className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
							actionClassName="w-auto justify-end"
							actions={
								<Switch
									checked={sidebarTranslucency ?? false}
									disabled={sidebarTranslucency === null}
									onCheckedChange={(enabled) => {
										setSidebarTranslucency(enabled);
										void window.app.setSidebarTranslucency(enabled).catch(() => setSidebarTranslucency(!enabled));
									}}
									aria-label={t('settings.application.sidebarTranslucency')}
								/>
							}
						/>
					)}
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.system.mediaPermissions.title')}>
				<MediaPermissionsSection />
			</SettingsSection>

			<SettingsSection title={t('settings.application.data')}>
				<SettingsPanel>
					<SettingsRow
						id="settings-app-data"
						title={t('settings.application.appData')}
						description={t('settings.application.appDataDescription')}
						media={
							<FolderOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						actionClassName="w-auto justify-end"
						actions={
							<Button variant="outline" size="xs" onClick={handleOpenAppDataFolder}>
								{t('settings.application.openAppData')}
							</Button>
						}
					/>
					<SettingsRow
						title={t('settings.application.dataFolder')}
						media={
							<FolderOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						actionClassName="w-auto justify-end"
						actions={
							<Button variant="outline" size="xs" onClick={handleOpenDataFolder}>
								{t('settings.application.openDataFolder')}
							</Button>
						}
					/>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default GeneralPage;
