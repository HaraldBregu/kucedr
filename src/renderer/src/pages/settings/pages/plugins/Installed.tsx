import React, { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PLUGIN_KINDS, type PluginInfo } from '@shared/plugin_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { SettingsNotice, SettingsSection } from '../../components';
import Confirm from './Confirm';

export default function Installed(): React.JSX.Element {
	const { t } = useTranslation();
	const [plugins, setPlugins] = useState<PluginInfo[]>([]);
	const [url, setUrl] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [pendingRemoval, setPendingRemoval] = useState<PluginInfo | null>(null);

	const load = useCallback(async (): Promise<void> => {
		setPlugins(await window.plugins.list());
	}, []);

	useEffect(() => {
		load().catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
	}, [load]);

	const run = async (action: () => Promise<PluginInfo | void | undefined>): Promise<void> => {
		setBusy(true);
		setError('');
		setNotice('');
		try {
			const installed = await action();
			if (installed)
				setNotice(t('settings.integrations.installed.installed', { name: installed.name }));
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const summary = (plugin: PluginInfo): string =>
		PLUGIN_KINDS.filter((kind) => plugin.contributes[kind].length > 0)
			.map((kind) =>
				t(`settings.integrations.installed.kinds.${kind}`, {
					count: plugin.contributes[kind].length,
				})
			)
			.join(' · ');

	return (
		<SettingsSection
			title={t('settings.integrations.installed.title')}
			description={t('settings.integrations.installed.description')}
			action={
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={busy}
					onClick={() => void run(() => window.plugins.upload())}
				>
					<Upload />
					{t('settings.integrations.installed.upload')}
				</Button>
			}
			className="pb-8"
		>
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					void run(async () => {
						const installed = await window.plugins.installUrl(url);
						setUrl('');
						return installed;
					});
				}}
			>
				<Input
					type="url"
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					placeholder={t('settings.integrations.installed.urlPlaceholder')}
					aria-label={t('settings.integrations.installed.urlLabel')}
					disabled={busy}
				/>
				<Button type="submit" size="sm" disabled={busy || !url.trim()}>
					{busy
						? t('settings.integrations.installed.installing')
						: t('settings.integrations.installed.install')}
				</Button>
			</form>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			{notice && <SettingsNotice autoDismiss>{notice}</SettingsNotice>}
			{plugins.length === 0 ? (
				<p className="px-3 py-2 text-xs text-muted-foreground">
					{t('settings.integrations.installed.empty')}
				</p>
			) : (
				<div className="-mx-4 grid grid-cols-1 gap-x-2 gap-y-3 md:grid-cols-2">
					{plugins.map((plugin) => (
						<Item
							key={plugin.id}
							variant="ghost"
							size="md"
							className="min-w-0 flex-nowrap gap-3 rounded-2xl px-3 py-2"
						>
							<ItemContent className="min-w-0 flex-1 flex-col items-start gap-0.5">
								<ItemTitle className="min-w-0 max-w-full gap-2 truncate text-sm font-medium leading-tight">
									{plugin.name}
									{plugin.version && (
										<span className="text-xs font-normal text-muted-foreground">
											{plugin.version}
										</span>
									)}
									{plugin.builtIn && (
										<Badge variant="secondary">
											{t('settings.integrations.installed.builtIn')}
										</Badge>
									)}
									{plugin.error && (
										<Badge variant="destructive">
											{t('settings.integrations.installed.unavailable')}
										</Badge>
									)}
								</ItemTitle>
								<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
									{plugin.error ?? summary(plugin)}
								</p>
							</ItemContent>
							<ItemActions className="ml-auto flex-none justify-end">
								<Switch
									checked={plugin.enabled}
									disabled={busy || Boolean(plugin.error)}
									onCheckedChange={(enabled) =>
										void run(() => window.plugins.setEnabled(plugin.id, enabled))
									}
									aria-label={t('settings.integrations.installed.enable', { name: plugin.name })}
								/>
								{!plugin.builtIn && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												disabled={busy}
												aria-label={t('settings.integrations.options', { name: plugin.name })}
											>
												<MoreHorizontal className="size-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => setPendingRemoval(plugin)}>
												<Trash2 />
												{t('settings.integrations.remove', { name: plugin.name })}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</ItemActions>
						</Item>
					))}
				</div>
			)}
			<Confirm
				name={pendingRemoval?.name ?? ''}
				open={pendingRemoval !== null}
				disabled={busy}
				onCancel={() => setPendingRemoval(null)}
				onConfirm={() => {
					const plugin = pendingRemoval;
					setPendingRemoval(null);
					if (plugin) void run(() => window.plugins.remove(plugin.id));
				}}
			/>
		</SettingsSection>
	);
}
