import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Blocks, Folder, Hash, Tag, Trash2, Unlink, User, Plug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOpenApp } from '@/hooks/app';
import type { App } from '../../../../../../../shared/installed_app_types';
import WindowSettings from './Window';
import AppIcon from '../AppIcon';
import Meta from '../../plugins/Meta';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
} from '../../../components';

const KNOWN_METADATA_KEYS = ['version', 'category', 'entry', 'image'];

const AppDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { appId } = useParams<{ appId: string }>();
	const decodedAppId = decodeURIComponent(appId ?? '');
	const [app, setApp] = useState<App | null>(null);
	const [loading, setLoading] = useState(true);
	const [opening, setOpening] = useState(false);
	const [deleting, setDeleting] = useState(false);
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

	const openApp = useOpenApp();
	const handleOpen = useCallback(
		async (separateWindow = false): Promise<void> => {
			if (!app) return;
			setOpening(true);
			setErrorMessage('');
			try {
				if (separateWindow) await window.apps.open(app.id);
				else await openApp(app);
			} catch {
				setErrorMessage(t('settings.apps.openError'));
			} finally {
				setOpening(false);
			}
		},
		[app, openApp, t]
	);

	const handleDelete = useCallback(async (): Promise<void> => {
		if (!app) return;
		setDeleting(true);
		setErrorMessage('');
		try {
			if (await window.apps.delete(app.id)) {
				navigate('/settings/apps');
			}
		} catch {
			setErrorMessage(t('settings.apps.deleteError'));
		} finally {
			setDeleting(false);
		}
	}, [app, navigate, t]);

	if (loading) {
		return (
			<SettingsPageShell>
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!app) {
		return (
			<SettingsPageShell>
				{errorMessage && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{errorMessage}
					</SettingsNotice>
				)}
				<SettingsEmptyState
					icon={Blocks}
					title={decodedAppId || t('settings.apps.empty')}
					description={t('settings.apps.emptyDescription')}
				/>
			</SettingsPageShell>
		);
	}

	const details = [
		{ key: 'id', title: t('settings.apps.detailId'), icon: Hash, value: app.id },
		{ key: 'version', title: t('settings.apps.detailVersion'), icon: Tag, value: app.metadata.version },
		{ key: 'category', title: t('settings.apps.detailCategory'), icon: Folder, value: app.metadata.category },
		{ key: 'author', title: t('settings.integrations.plugin.author'), icon: User, value: app.author },
		{ key: 'plugin', title: t('settings.scripts.plugin'), icon: Plug, value: app.plugin?.name },
		...Object.entries(app.metadata)
			.filter(([key]) => !KNOWN_METADATA_KEYS.includes(key))
			.map(([key, value]) => ({
				key,
				title: key,
				icon: Tag,
				value: typeof value === 'string' ? value : JSON.stringify(value),
			})),
	].filter((row) => row.value);

	return (
		<SettingsPageShell>
			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}
			<header className="mb-6 flex items-start gap-4 py-2">
				<div className="min-w-0 flex-1">
					<div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-muted/50 p-2">
						<AppIcon app={app} className="size-full" />
					</div>
					<h1 className="flex flex-wrap items-center gap-2 text-3xl font-normal leading-9 text-foreground">
						{app.title}
						{import.meta.env.DEV && app.debugPath && (
							<Badge variant="outline">{t('settings.apps.debug.badge')}</Badge>
						)}
					</h1>
					<p className="mt-1.5 max-w-2xl text-base leading-5 text-muted-foreground">
						{app.description}
					</p>
					<Meta rows={details} />
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<Button
						type="button"
						size="sm"
						disabled={opening || deleting}
						onClick={() => void handleOpen()}
					>
						{t('settings.apps.open')}
					</Button>
					{app.mode === 'both' && (
						<Button type="button" size="sm" variant="outline" disabled={opening || deleting} onClick={() => void handleOpen(true)}>
							{t('settings.apps.openWindow')}
						</Button>
					)}
					{!app.plugin && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={opening || deleting}
							onClick={() => void handleDelete()}
						>
							{app.debugPath ? <Unlink /> : <Trash2 />}
							{deleting
								? t('settings.apps.deleting')
								: t(app.debugPath ? 'settings.apps.debug.remove' : 'settings.apps.deleteAction', {
										name: app.title,
									})}
						</Button>
					)}
				</div>
			</header>
			<div className="flex flex-col gap-8 pb-8">
				{(app.mode === 'window' || app.mode === 'both') && <WindowSettings key={app.id} appId={app.id} />}
			</div>
		</SettingsPageShell>
	);
};

export default AppDetailsPage;
