import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AudioWaveform,
	ChevronRight,
	Coffee,
	FolderOpen,
	Languages,
	PanelTop,
	SunMoon,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/kibo-ui/theme-switcher';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp, type AppLanguage } from '@/contexts';
import { SettingsPageHeader, SettingsPageShell, SettingsSection } from '../../components';

interface LanguageOption {
	readonly value: AppLanguage;
	readonly labelKey: string;
}

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
	{ value: 'en', labelKey: 'settings.language.en' },
	{ value: 'it', labelKey: 'settings.language.it' },
] as const;

const GeneralPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { language, setLanguage, theme, setTheme } = useApp();
	const [trayEnabled, setTrayEnabled] = useState(true);
	const [keepAwake, setKeepAwake] = useState(false);

	useEffect(() => {
		void window.app.getTrayEnabled().then(setTrayEnabled);
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
				<Card size="sm" className="gap-0! p-0!">
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.application.name')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<span className="text-[13px] text-foreground">{__APP_NAME__}</span>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemContent>
							<ItemTitle>{t('settings.application.version')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<span className="font-mono text-[13px] text-foreground">{__APP_VERSION__}</span>
						</ItemActions>
					</Item>
				</Card>
			</SettingsSection>

			<SettingsSection title={t('settings.application.actions')}>
				<Card size="sm" className="gap-0! p-0!">
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<PanelTop className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.application.menuBar')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<Switch
								checked={trayEnabled}
								onCheckedChange={handleTrayToggle}
								aria-label={t('settings.application.menuBar')}
							/>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<Coffee className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.application.keepAwake')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<Switch
								checked={keepAwake}
								onCheckedChange={handleKeepAwakeToggle}
								aria-label={t('settings.application.keepAwake')}
							/>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<FolderOpen className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.application.appData')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<Button variant="outline" size="xs" onClick={handleOpenAppDataFolder}>
								{t('settings.application.openAppData')}
							</Button>
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<FolderOpen className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.application.dataFolder')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<Button variant="outline" size="xs" onClick={handleOpenDataFolder}>
								{t('settings.application.openDataFolder')}
							</Button>
						</ItemActions>
					</Item>
				</Card>
			</SettingsSection>

			<SettingsSection title={t('settings.sections.layout')}>
				<Card size="sm" className="gap-0! p-0!">
					<Item
						as="button"
						type="button"
						variant="outline"
						size="md"
						className="cursor-pointer border-b border-border/60 hover:bg-muted/40 px-5 py-4"
						onClick={() => navigate('/settings/general/persona')}
					>
						<ItemMedia variant="icon">
							<AudioWaveform className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.persona.title')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.8} />
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<Languages className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.language.title')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
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
						</ItemActions>
					</Item>
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<SunMoon className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{t('settings.theme.title')}</ItemTitle>
						</ItemContent>
						<ItemActions className="ml-auto flex-none justify-end">
							<ThemeSwitcher value={theme} onChange={setTheme} />
						</ItemActions>
					</Item>
				</Card>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default GeneralPage;
