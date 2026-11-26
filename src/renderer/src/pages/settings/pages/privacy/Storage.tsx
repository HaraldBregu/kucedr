import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import type { StorageUsage } from '@shared/data_types';
import { DataControls } from '../../components/data';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../components';

function formatBytes(bytes: number): string {
	if (bytes < 1_024) return `${bytes} B`;
	if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
	if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
	return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

export function Storage(): React.JSX.Element {
	const { t } = useTranslation();
	const [usage, setUsage] = useState<StorageUsage | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let mounted = true;
		void window.dataControls.getStorageUsage().then(
			(result) => {
				if (mounted) setUsage(result);
			},
			() => {
				if (mounted) setError(true);
			}
		);
		return () => {
			mounted = false;
		};
	}, []);

	return (
		<>
			<SettingsSection title={t('settings.storageManagement.title')}>
			{error ? (
				<SettingsNotice variant="destructive">{t('settings.storageManagement.loadError')}</SettingsNotice>
			) : (
				<SettingsPanel>
					<SettingsRow
						title={t('settings.storageManagement.total')}
						actions={<span className="text-sm tabular-nums">{usage ? formatBytes(usage.totalBytes) : '…'}</span>}
					/>
					{usage?.areas.map((area) => (
						<SettingsRow
							key={area.name}
							title={t(`settings.storageManagement.areas.${area.name}`, { defaultValue: area.name })}
							actions={<span className="text-sm tabular-nums">{formatBytes(area.bytes)}</span>}
						/>
					))}
					<SettingsRow
						title={t('settings.storageManagement.retention')}
						description={t('settings.storageManagement.retentionDescription')}
					/>
					<SettingsRow
						title={t('settings.storageManagement.cleanup')}
						actions={
							<div className="flex flex-wrap gap-2">
								<Link to="/settings/memory" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
									{t('settings.storageManagement.memoryControls')}
								</Link>
								<Link to="/settings/knowledge" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
									{t('settings.storageManagement.knowledgeControls')}
								</Link>
							</div>
						}
					/>
				</SettingsPanel>
			)}
			</SettingsSection>
			<SettingsSection title={t('settings.dataControls.title')}>
				<DataControls kinds={['sessions']} />
			</SettingsSection>
		</>
	);
}
