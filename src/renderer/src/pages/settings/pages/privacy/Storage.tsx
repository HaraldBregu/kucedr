import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
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
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState(false);

	const exportAll = async (): Promise<void> => {
		setExporting(true);
		setExportError(false);
		try {
			await window.dataControls.exportAll();
		} catch {
			setExportError(true);
		} finally {
			setExporting(false);
		}
	};

	const days = (value: number): string =>
		value ? t('settings.storageManagement.chatRetentionDays', { count: value }) : t('settings.storageManagement.chatRetentionOff');

	useEffect(() => {
		let mounted = true;
		void window.dataControls.getChatRetention().then(
			(result) => {
				if (mounted) setRetention(result);
			},
			() => {
				if (mounted) setError(true);
			}
		);
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
		<div className="flex flex-col gap-4">
			<SettingsSection title={t('settings.dataControls.exportAllTitle')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.dataControls.exportAllTitle')}
						description={t('settings.dataControls.exportAllDescription')}
						actions={
							<Button variant="outline" disabled={exporting} onClick={() => void exportAll()}>
								<Download className="size-3" />
								{t('settings.dataControls.exportAllAction')}
							</Button>
						}
					/>
				</SettingsPanel>
				{exportError && (
					<SettingsNotice variant="destructive">
						{t('settings.dataControls.exportAllError')}
					</SettingsNotice>
				)}
			</SettingsSection>
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
						title={t('settings.storageManagement.chatRetention')}
						description={t('settings.storageManagement.chatRetentionDescription')}
						actionClassName="w-auto justify-end"
						actions={
							<Select
								value={retention === null ? null : String(retention)}
								disabled={retention === null}
								onValueChange={(value) => {
									if (value !== null) {
										void window.dataControls.setChatRetention(Number(value)).then(setRetention, () => {
											setError(true);
										});
									}
								}}
							>
								<SelectTrigger
									size="sm"
									className="w-28 text-xs [&_svg]:size-3"
									aria-label={t('settings.storageManagement.chatRetention')}
								>
									<SelectValue>{retention === null ? '…' : days(retention)}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{CHAT_RETENTION_DAYS.map((value) => (
										<SelectItem key={value} value={String(value)}>
											{days(value)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
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
		</div>
	);
}
