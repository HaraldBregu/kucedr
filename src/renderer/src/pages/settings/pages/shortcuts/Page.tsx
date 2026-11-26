import { useTranslation } from 'react-i18next';
import { SHORTCUTS } from '@shared/app_types';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel } from '../../components';

const platform = navigator.platform.startsWith('Mac') ? 'mac' : /Win/.test(navigator.platform) ? 'win' : 'linux';
const areas = ['app', 'chat', 'workspace', 'browser'] as const;

export default function ShortcutsPage(): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.shortcuts.title')} description={t('settings.shortcuts.description')} />
			<div className="space-y-4">
				{areas.map((area) => {
					const shortcuts = SHORTCUTS.filter((shortcut) => shortcut.area === area);
					return shortcuts.length ? (
						<SettingsPanel key={area}>
							<h2 className="px-4 pb-2 pt-4 text-sm font-medium">{t(`settings.shortcuts.groups.${area}`)}</h2>
							{shortcuts.map((shortcut) => (
								<div key={shortcut.id} className="flex min-h-11 items-center justify-between gap-4 border-t px-4 py-2">
									<span className="text-sm">{t(`settings.shortcuts.keys.${shortcut.labelKey}`)}</span>
									<kbd className="shrink-0 rounded border bg-muted px-2 py-1 font-mono text-xs">{shortcut[platform]}</kbd>
								</div>
							))}
						</SettingsPanel>
					) : null;
				})}
			</div>
		</SettingsPageShell>
	);
}
