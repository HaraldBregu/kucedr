import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, AppWindow, ArrowLeft, Blocks, Trash2, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOpenApp } from '@/hooks/app';
import type { App } from '../../../../../../../shared/installed_app_types';
import WindowSettings from './Window';
import AppIcon from '../AppIcon';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
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
		async (target?: 'window'): Promise<void> => {
			if (!app) return;
			setOpening(true);
			setErrorMessage('');
			try {
				await openApp(app, target);
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

	const back = (
		<Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/settings/apps')}>
			<ArrowLeft className="size-4" />
			{t('settings.tabs.apps')}
		</Button>
	);

	if (loading) {
		return (
			<SettingsPageShell>
				{back}
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!app) {
		return (
			<SettingsPageShell>
				{back}
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

	const details: { key: string; title: string; value: string; mono?: boolean }[] = [
		{ key: 'id', title: t('settings.apps.detailId'), value: app.id, mono: true },
		{
			key: 'mode',
			title: t('settings.apps.detailMode'),
			value: t(`settings.apps.modes.${app.mode ?? 'extension'}`),
		},
		{ key: 'version', title: t('settings.apps.detailVersion'), value: app.metadata.version },
		{ key: 'category', title: t('settings.apps.detailCategory'), value: app.metadata.category },
		{ key: 'entry', title: t('settings.apps.detailEntry'), value: app.metadata.entry, mono: true },
		...Object.entries(app.metadata)
			.filter(([key]) => !KNOWN_METADATA_KEYS.includes(key))
			.map(([key, value]) => ({
				key,
				title: key,
				value: typeof value === 'string' ? value : JSON.stringify(value),
			})),
	];

	return (
		<SettingsPageShell>
			{back}
			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}
			<header className="mb-6 flex items-start gap-4 py-2">
				<AppIcon app={app} className="size-14" />
				<div className="min-w-0 flex-1">
					<h1 className="flex flex-wrap items-center gap-2 text-3xl font-normal leading-9 text-foreground">
						{app.title}
						{import.meta.env.DEV && app.debugPath && (
							<Badge variant="outline">{t('settings.apps.debug.badge')}</Badge>
						)}
					</h1>
					<p className="mt-1.5 max-w-2xl text-base leading-5 text-muted-foreground">
						{app.description}
					</p>
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
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={opening || deleting}
							onClick={() => void handleOpen('window')}
						>
							<AppWindow />
							{t('settings.apps.openInWindow')}
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
				<SettingsSection title={t('settings.apps.information')}>
					<SettingsPanel>
						{details.map((row) => (
							<SettingsRow key={row.key} title={row.title}>
								<SettingsValue mono={row.mono}>{row.value}</SettingsValue>
							</SettingsRow>
						))}
					</SettingsPanel>
				</SettingsSection>
				{app.mode && app.mode !== 'extension' && <WindowSettings key={app.id} appId={app.id} />}
			</div>
		</SettingsPageShell>
	);
};

export default AppDetailsPage;
