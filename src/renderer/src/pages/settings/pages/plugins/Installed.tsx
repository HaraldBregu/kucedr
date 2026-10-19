import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Plug, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PluginInfo } from '@shared/plugin_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettingsNotice, SettingsSection } from '../../components';
import Confirm from './Confirm';

export default function Installed({ query = '' }: { readonly query?: string }): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [plugins, setPlugins] = useState<PluginInfo[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [pendingRemoval, setPendingRemoval] = useState<PluginInfo | null>(null);

	const load = useCallback(async (): Promise<void> => {
		setPlugins(await window.plugins.list());
	}, []);

	useEffect(() => {
		load().catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
	}, [load]);

	const run = async (action: () => Promise<void>): Promise<void> => {
		setBusy(true);
		setError('');
		try {
			await action();
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	};

	const normalizedQuery = query.trim().toLocaleLowerCase();
	const visible = plugins.filter(
		(plugin) =>
			!normalizedQuery ||
			[plugin.name, plugin.description ?? '', plugin.id].some((value) =>
				value.toLocaleLowerCase().includes(normalizedQuery)
			)
	);

	const groups = [
		{
			key: 'builtIn',
			title: t('settings.integrations.installed.builtInTitle'),
			description: t('settings.integrations.installed.builtInDescription'),
			empty: t('settings.integrations.installed.builtInEmpty'),
			plugins: visible.filter((plugin) => plugin.builtIn),
		},
		{
			key: 'downloaded',
			title: t('settings.integrations.installed.downloadedTitle'),
			description: t('settings.integrations.installed.downloadedDescription'),
			empty: t('settings.integrations.installed.empty'),
			plugins: visible.filter((plugin) => !plugin.builtIn),
		},
	];

	return (
		<>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			{groups.map((group) => (
				<SettingsSection
					key={group.key}
					title={group.title}
					description={group.description}
					className="pb-8"
				>
					{group.plugins.length === 0 ? (
						<p className="px-3 py-2 text-xs text-muted-foreground">
							{normalizedQuery ? t('settings.integrations.noResults') : group.empty}
						</p>
					) : (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{group.plugins.map((plugin) => (
								<Card
									key={plugin.id}
									size="sm"
									role="link"
									tabIndex={0}
									className="h-24 cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50"
									onClick={() => navigate(`/settings/plugins/${plugin.id}`)}
									onKeyDown={(event) => {
										if (
											event.target === event.currentTarget &&
											(event.key === 'Enter' || event.key === ' ')
										) {
											event.preventDefault();
											navigate(`/settings/plugins/${plugin.id}`);
										}
									}}
								>
									<CardHeader className="flex items-start gap-3">
										{plugin.icon ? (
											<img src={plugin.icon} alt="" className="size-10 shrink-0 object-contain" />
										) : (
											<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
												<Plug className="size-5" aria-hidden="true" />
											</div>
										)}
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
												<span className="truncate">{plugin.name}</span>
												{plugin.version && (
													<span className="text-xs font-normal text-muted-foreground">
														{plugin.version}
													</span>
												)}
												{plugin.error && (
													<Badge variant="destructive">
														{t('settings.integrations.installed.unavailable')}
													</Badge>
												)}
											</CardTitle>
											<CardDescription className="line-clamp-2">
												{plugin.error ?? plugin.description}
											</CardDescription>
										</div>
										<div
											className="flex shrink-0 items-center gap-1"
											onClick={(event) => event.stopPropagation()}
											onKeyDown={(event) => event.stopPropagation()}
										>
											{!plugin.core && (
												<Button
													type="button"
													size="sm"
													variant={plugin.enabled ? 'outline' : 'default'}
													disabled={busy || Boolean(plugin.error)}
													onClick={() =>
														void run(() => window.plugins.setEnabled(plugin.id, !plugin.enabled))
													}
												>
													{plugin.enabled
														? t('settings.integrations.installed.disable')
														: t('settings.integrations.installed.enableAction')}
												</Button>
											)}
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
										</div>
									</CardHeader>
								</Card>
							))}
						</div>
					)}
				</SettingsSection>
			))}
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
		</>
	);
}
