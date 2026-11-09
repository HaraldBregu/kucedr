import { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PluginScriptInfo } from '@shared/plugin_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../../components';

/** The API key a VECTOR script receives, saved encrypted for that script. */
export default function VectorConfiguration({
	script,
}: {
	script: PluginScriptInfo;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [saved, setSaved] = useState(false);
	const [apiKey, setApiKey] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		void window.plugins.getSettings(script.plugin.id).then(
			(values) => setSaved(Boolean(values[script.name])),
			(err: unknown) => setError(getErrorMessage(err, t('settings.scripts.loadError')))
		);
	}, [script, t]);

	const save = async (): Promise<void> => {
		setSaving(true);
		setError('');
		try {
			const values = await window.plugins.getSettings(script.plugin.id);
			await window.plugins.saveSettings(script.plugin.id, {
				...values,
				[script.name]: apiKey.trim(),
			});
			setSaved(true);
			setApiKey('');
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
			<SettingsPanel>
				<SettingsRow
					title={t('settings.scripts.apiKey')}
					description={t('settings.scripts.apiKeyDescription')}
					icon={KeyRound}
					actions={
						<form
							className="flex gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								void save();
							}}
						>
							<Input
								type="password"
								value={apiKey}
								aria-label={t('settings.scripts.apiKey')}
								placeholder={saved ? t('settings.scripts.apiKeySaved') : ''}
								className="w-64 max-w-full text-xs"
								disabled={saving}
								onChange={(event) => setApiKey(event.target.value)}
							/>
							<Button type="submit" size="sm" disabled={saving || !apiKey.trim()}>
								{t('settings.scripts.save')}
							</Button>
						</form>
					}
				/>
			</SettingsPanel>
		</SettingsSection>
	);
}
