import { useEffect, useState } from 'react';
import { AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { PluginScriptInfo } from '@shared/plugin_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../../components';

/** The values a script declares in its manifest `settings`, saved for that script and sent to it on every run. */
export default function Setup({ script }: { script: PluginScriptInfo }): React.JSX.Element {
	const { t } = useTranslation();
	const [values, setValues] = useState<Record<string, string>>({});
	const [saved, setSaved] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const properties = Object.entries(script.settings?.properties ?? {});
	const required = new Set(script.settings?.required ?? []);
	const missing = [...required].some(
		(key) => !saved[key] && script.settings?.properties?.[key]?.default === undefined
	);

	useEffect(() => {
		void window.scripts.getSettings(script.name).then(
			(current) => {
				setValues(current);
				setSaved(current);
			},
			(err: unknown) => setError(getErrorMessage(err, t('settings.scripts.loadError')))
		);
	}, [script, t]);

	const save = async (next: Record<string, string> = values): Promise<void> => {
		setSaving(true);
		setError('');
		try {
			await window.scripts.saveSettings(script.name, next);
			setSaved(next);
		} catch (err) {
			setError(getErrorMessage(err, t('settings.storageProviders.saveError')));
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsSection title={t('settings.integrations.plugin.configuration')}>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{missing && (
				<SettingsNotice icon={AlertTriangle}>{t('settings.scripts.setupRequired')}</SettingsNotice>
			)}
			<SettingsPanel>
				{properties.map(([key, property]) => (
					<SettingsRow
						key={key}
						title={property.title ?? key}
						description={property.description}
						icon={SlidersHorizontal}
						actions={
							property.type === 'boolean' ? (
								<Switch
									checked={(saved[key] ?? String(property.default ?? false)) === 'true'}
									aria-label={property.title ?? key}
									disabled={saving}
									onCheckedChange={(checked) => {
										const next = { ...saved, [key]: String(checked) };
										setValues((current) => ({ ...current, [key]: String(checked) }));
										void save(next);
									}}
								/>
							) : (
								<form
									className="flex gap-2"
									onSubmit={(event) => {
										event.preventDefault();
										void save();
									}}
								>
									<Input
										value={values[key] ?? ''}
										aria-label={property.title ?? key}
										className="h-7 w-64 max-w-full px-2.5 text-xs md:text-xs"
										spellCheck={false}
										disabled={saving}
										onChange={(event) =>
											setValues((current) => ({ ...current, [key]: event.target.value }))
										}
									/>
									<Button
										type="submit"
										size="sm"
										disabled={saving || (values[key] ?? '') === (saved[key] ?? '')}
									>
										{t('settings.scripts.save')}
									</Button>
								</form>
							)
						}
					/>
				))}
			</SettingsPanel>
		</SettingsSection>
	);
}
