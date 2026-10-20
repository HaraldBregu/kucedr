import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LayoutPanelLeft, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PluginExtension, PluginInfo } from '@shared/plugin_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsUpload } from '../../components/upload';

type Entry = PluginExtension & { readonly plugin?: PluginInfo };

export default function ExtensionsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');

	const load = useCallback(async (): Promise<void> => {
		try {
			const [plugins, standalone] = await Promise.all([
				window.plugins.list(),
				window.plugins.listExtensions(),
			]);
			setEntries([
				...standalone,
				...plugins
					.filter((plugin) => plugin.enabled && !plugin.error)
					.flatMap((plugin) => plugin.extensions.map((extension) => ({ ...extension, plugin }))),
			]);
		} catch {
			setEntries([]);
			setErrorMessage(t('settings.extensions.loadError'));
		}
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleImport = async (paths?: string[]): Promise<void> => {
		setBusy(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await window.plugins.importExtensions(paths);
			if (!result) return;
			if (result.imported.length > 0) {
				setSuccessMessage(
					t('settings.extensions.uploaded', { count: String(result.imported.length) })
				);
				await load();
			}
			if (result.skipped.length > 0) {
				setErrorMessage(result.skipped.map(({ name, reason }) => `${name}: ${reason}`).join('\n'));
			}
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : t('settings.extensions.uploadError'));
		} finally {
			setBusy(false);
		}
	};

	const handleRemove = async (id: string): Promise<void> => {
		setBusy(true);
		setErrorMessage('');
		try {
			if (await window.plugins.removeExtension(id)) await load();
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.extensions.title')}
				description={t('settings.extensions.description')}
			/>

			{errorMessage && (
				<SettingsNotice
					variant="destructive"
					icon={AlertTriangle}
					className="whitespace-pre-wrap break-words"
				>
					{errorMessage}
				</SettingsNotice>
			)}

			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}

			<SettingsUpload
				title={t('settings.extensions.dropTitle')}
				description={t('settings.extensions.emptyDescription')}
				busy={busy}
				busyLabel={t('settings.extensions.uploading')}
				onUpload={(paths) => void handleImport(paths)}
			/>

			{(entries === null || entries.length > 0) && (
				<section className="pb-4" aria-labelledby="installed-extensions-title">
					<h2 id="installed-extensions-title" className="mb-2 text-sm font-medium">
						{t('settings.extensions.installed')}
					</h2>
					{entries === null ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{entries.map((entry) => (
								<Card key={`${entry.plugin?.id ?? ''}/${entry.id}`} size="sm" className="h-22">
									<CardHeader className="flex items-start gap-3">
										{entry.icon ? (
											<img src={entry.icon} alt="" className="size-8 shrink-0 object-contain" />
										) : (
											<div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
												<LayoutPanelLeft className="size-1/2" aria-hidden="true" />
											</div>
										)}
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
												<span className="truncate">{entry.title}</span>
												<span className="text-xs font-normal text-muted-foreground">
													{entry.plugin?.name ?? `@${entry.id}`}
												</span>
												<Badge variant="secondary">
													{t(`settings.extensions.slots.${entry.slot}`)}
												</Badge>
											</CardTitle>
											<CardDescription className="line-clamp-2">
												{entry.description}
											</CardDescription>
										</div>
										{!entry.plugin && (
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="shrink-0"
												disabled={busy}
												onClick={() => void handleRemove(entry.id)}
												aria-label={t('settings.extensions.remove', { name: entry.title })}
											>
												<Trash2 className="size-4" />
											</Button>
										)}
									</CardHeader>
								</Card>
							))}
						</div>
					)}
				</section>
			)}
		</SettingsPageShell>
	);
}
