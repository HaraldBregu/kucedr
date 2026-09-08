import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Blocks, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import type { App } from '../../../../../../../shared/installed_app_types';
import WindowSettings from './Window';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../../components';

const KNOWN_METADATA_KEYS = ['version', 'category', 'entry'];

const AppDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const { appId } = useParams<{ appId: string }>();
	const decodedAppId = decodeURIComponent(appId ?? '');
	const [app, setApp] = useState<App | null>(null);
	const [loading, setLoading] = useState(true);
	const [opening, setOpening] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const loadErrorFallback = t('settings.apps.loadError');

	const loadApp = useCallback(async (): Promise<void> => {
		setLoading(true);
		setErrorMessage('');
		try {
			const list = await window.apps.list();
			setApp(list.find((item) => item.id === decodedAppId) ?? null);
		} catch {
			setErrorMessage(loadErrorFallback);
			setApp(null);
		} finally {
			setLoading(false);
		}
	}, [decodedAppId, loadErrorFallback]);

	useEffect(() => {
		void loadApp();
	}, [loadApp]);

	const handleOpen = useCallback(async (): Promise<void> => {
		if (!app) return;
		setOpening(true);
		setErrorMessage('');
		try {
			await window.apps.open(app.id);
		} catch {
			setErrorMessage(t('settings.apps.openError'));
		} finally {
			setOpening(false);
		}
	}, [app, t]);

	if (loading) {
		return (
			<SettingsPageShell>
				<SettingsPageHeader title={t('settings.apps.details')} />
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!app) {
		return (
			<SettingsPageShell>
				<SettingsPageHeader title={t('settings.apps.details')} />
				{errorMessage && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{errorMessage}
					</SettingsNotice>
				)}
				<SettingsPanel>
					<SettingsEmptyState
						icon={Blocks}
						title={decodedAppId || t('settings.apps.empty')}
						description={t('settings.apps.emptyDescription')}
						className="min-h-28"
					/>
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	const extraMetadata = Object.entries(app.metadata).filter(
		([key]) => !KNOWN_METADATA_KEYS.includes(key)
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={app.title}
				description={app.description}
				action={
					<Button variant="outline" size="xs" onClick={() => void handleOpen()} disabled={opening}>
						<ExternalLink className="size-3" />
						{t('settings.apps.open')}
					</Button>
				}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			<WindowSettings key={app.id} appId={app.id} />

			<SettingsSection title={t('settings.apps.details')}>
				<SettingsPanel>
					<AppDetail label={t('settings.apps.detailId')} value={app.id} mono />
					<AppDetail
						label={t('settings.apps.detailVersion')}
						value={app.metadata.version}
					/>
					<AppDetail
						label={t('settings.apps.detailCategory')}
						value={app.metadata.category}
					/>
					<AppDetail
						label={t('settings.apps.detailEntry')}
						value={app.metadata.entry}
						mono
					/>
					{extraMetadata.map(([key, value]) => (
						<AppDetail
							key={key}
							label={key}
							value={typeof value === 'string' ? value : JSON.stringify(value)}
						/>
					))}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

function AppDetail({
	label,
	value,
	mono,
}: {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}): React.JSX.Element {
	return (
		<Item variant="outline" size="md" className="border-b border-border/60 last:border-b-0 px-5 py-4">
			<ItemContent className="min-w-0">
				<ItemTitle>{label}</ItemTitle>
			</ItemContent>
			<ItemActions className="ml-auto min-w-0 flex-none justify-end">
				<span
					className={
						mono
							? 'max-w-md break-all text-right font-mono text-[11px] text-foreground'
							: 'max-w-md break-words text-right text-xs text-foreground'
					}
				>
					{value}
				</span>
			</ItemActions>
		</Item>
	);
}

export default AppDetailsPage;
