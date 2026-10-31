import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { StorageProvider } from '@shared/storage_types';
import { SettingsPanel, SettingsRow, SettingsValue } from '../../components';

interface ProviderProps {
	readonly provider?: StorageProvider;
}

export default function Provider({ provider }: ProviderProps): React.JSX.Element {
	const { t } = useTranslation();
	const [script, setScript] = useState<string>();

	useEffect(() => {
		void window.plugins
			.scripts()
			.then((scripts) => setScript(scripts.find((entry) => entry.type === 'STORAGE')?.name))
			.catch(() => undefined);
	}, []);

	return (
		<SettingsPanel>
			<SettingsRow
				title={t('settings.storage.provider.title')}
				description={t('settings.storage.provider.description')}
				actions={
					<div className="flex flex-wrap items-center justify-end gap-2">
						<SettingsValue>
							{provider
								? `${provider.name} · ${provider.bucket}`
								: t('settings.storage.provider.placeholder')}
						</SettingsValue>
						<Button
							variant="outline"
							size="sm"
							nativeButton={false}
							render={
								<Link
									to={
										script ? `/settings/scripts/${encodeURIComponent(script)}` : '/settings/scripts'
									}
								/>
							}
						>
							{t(provider ? 'settings.storageProviders.editTitle' : 'settings.storageProviders.add')}
						</Button>
					</div>
				}
			/>
		</SettingsPanel>
	);
}
