import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
	AudioWaveform,
	ChevronRight,
	Coffee,
	FolderOpen,
	Languages,
	MousePointerClick,
	PanelTop,
	SunMoon,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/kibo-ui/theme-switcher';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp, type AppLanguage } from '@/contexts';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';

interface LanguageOption {
	readonly value: AppLanguage;
	readonly labelKey: string;
}

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
	{ value: 'en', labelKey: 'settings.language.en' },
	{ value: 'it', labelKey: 'settings.language.it' },
] as const;

const TRAY_CLICK_ACTION_OPTIONS = [
	{ value: 'toggle-chat', labelKey: 'settings.application.trayClickAction.toggleChat' },
	{ value: 'start-persona', labelKey: 'settings.application.trayClickAction.startPersona' },
	{ value: 'toggle-persona', labelKey: 'settings.application.trayClickAction.togglePersona' },
] as const;

type TrayClickAction = (typeof TRAY_CLICK_ACTION_OPTIONS)[number]['value'];

const GeneralPage: React.FC = () => {
	const { t } = useTranslation();
	const { language, setLanguage, theme, setTheme } = useApp();
	const [trayEnabled, setTrayEnabled] = useState(true);
	const [trayClickAction, setTrayClickAction] = useState<TrayClickAction>('toggle-chat');
	const [keepAwake, setKeepAwake] = useState(false);

	useEffect(() => {
		void window.app.getTrayEnabled().then(setTrayEnabled);
		void window.app.getTrayClickAction().then(setTrayClickAction);
		void window.app.getKeepAwake().then(setKeepAwake);
		const offTrayEnabled = window.app.onTrayEnabledChanged(setTrayEnabled);
		const offKeepAwake = window.app.onKeepAwakeChanged(setKeepAwake);
		return () => {
			offTrayEnabled();
			offKeepAwake();
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

	const handleTrayClickActionChange = (next: string | null): void => {
		if (next === null) return;
		const option = TRAY_CLICK_ACTION_OPTIONS.find((item) => item.value === next);
		if (!option) return;
		setTrayClickAction(option.value);
		void window.app.setTrayClickAction(option.value);
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

	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.tabs.general')} />

			<SettingsSection title={t('settings.application.information')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.application.name')}
						description={t('settings.application.nameDescription')}
						actionClassName="w-auto justify-end"
						actions={<span className="text-[13px] text-foreground">{__APP_NAME__}</span>}
					/>
					<SettingsRow
						title={t('settings.application.version')}
						description={t('settings.application.versionDescription')}
						actionClassName="w-auto justify-end"
						actions={
							<span className="font-mono text-[13px] text-foreground">{__APP_VERSION__}</span>
						}
					/>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.application.actions')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.application.menuBar')}
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
									className="w-40 text-xs [&_svg]:size-3"
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
					<SettingsRow
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

			<SettingsSection title={t('settings.sections.layout')}>
				<SettingsPanel>
					<Link to="/settings/general/persona" className="block hover:bg-muted/40">
						<SettingsRow
							title={t('settings.persona.title')}
							description={t('settings.persona.description')}
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
						title={t('settings.theme.title')}
						media={<SunMoon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						actionClassName="w-auto justify-end"
						actions={<ThemeSwitcher value={theme} onChange={setTheme} />}
					/>
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default GeneralPage;
