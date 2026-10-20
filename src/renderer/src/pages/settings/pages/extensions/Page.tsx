import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LayoutPanelLeft, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PluginExtension, PluginInfo } from '@shared/plugin_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
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
			await window.plugins.removeExtension(id);
			await load();
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

			<section className="-mx-4 pb-4" aria-labelledby="installed-extensions-title">
				<h2 id="installed-extensions-title" className="mb-2 px-3 text-sm font-medium">
					{t('settings.extensions.installed')}
				</h2>
				{entries === null ? (
					<SettingsPanel>
						<SettingsLoadingRows rows={2} />
					</SettingsPanel>
				) : entries.length === 0 ? (
					<p className="px-3 text-xs text-muted-foreground">{t('settings.extensions.empty')}</p>
				) : (
					<div className="grid grid-cols-1 gap-x-2 gap-y-3 md:grid-cols-2">
						{entries.map((entry) => (
							<Item
								key={`${entry.plugin?.id ?? ''}/${entry.id}`}
								variant="ghost"
								size="md"
								className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2"
							>
								{entry.icon ? (
									<img
										src={entry.icon}
										alt=""
										className="size-10 shrink-0 rounded-2xl bg-muted/50 object-contain p-2.5"
									/>
								) : (
									<div
										aria-hidden="true"
										className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground"
									>
										<LayoutPanelLeft className="size-5" />
									</div>
								)}
								<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
									<ItemTitle className="min-w-0 max-w-full gap-1.5 text-sm font-medium leading-tight">
										<h3 className="truncate">{entry.title}</h3>
										<Badge variant="secondary" className="shrink-0 text-[10px] leading-none">
											{t(`settings.extensions.slots.${entry.slot}`)}
										</Badge>
									</ItemTitle>
									<p className="max-w-full truncate text-[11px] leading-tight text-muted-foreground">
										{entry.plugin?.name ?? `@${entry.id}`}
									</p>
									<p className="line-clamp-2 text-xs leading-4 text-muted-foreground">
										{entry.description}
									</p>
								</ItemContent>
								{!entry.plugin && (
									<ItemActions className="ml-auto flex-none justify-end">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											disabled={busy}
											onClick={() => void handleRemove(entry.id)}
											aria-label={t('settings.extensions.remove', { name: entry.title })}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</ItemActions>
								)}
							</Item>
						))}
					</div>
				)}
			</section>
		</SettingsPageShell>
	);
}
