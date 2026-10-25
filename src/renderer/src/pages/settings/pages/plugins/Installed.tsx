import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Power, PowerOff, Tag, Trash2, User } from 'lucide-react';
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
import { SettingsNotice } from '../../components';
import { SettingsFilter } from '../../components/filter';
import Confirm from './Confirm';
import PluginIcon from './PluginIcon';

export default function Installed(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [plugins, setPlugins] = useState<PluginInfo[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [pendingRemoval, setPendingRemoval] = useState<PluginInfo | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('all');

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
	const categories = [...new Set(plugins.flatMap((plugin) => plugin.categories))].sort();
	const visible = plugins.filter(
		(plugin) =>
			(category === 'all' ||
				(plugin.builtIn ? 'builtIn' : 'downloaded') === category ||
				plugin.categories.includes(category)) &&
			[plugin.name, plugin.description ?? '', plugin.id].some((value) =>
				value.toLocaleLowerCase().includes(normalizedQuery)
			)
	);

	return (
		<>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<section className="pb-4">
				<SettingsFilter
					query={query}
					onQueryChange={setQuery}
					categories={['builtIn', 'downloaded', ...categories]}
					category={category}
					onCategoryChange={setCategory}
				/>
				<div className="grid grid-cols-1 gap-3">
					{visible.map((plugin) => (
						<Card
							key={plugin.id}
							size="sm"
							role="link"
							tabIndex={0}
							className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
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
							<CardHeader className="flex flex-1 items-center gap-3">
								<PluginIcon plugin={plugin} className="size-12" />
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<div className="flex items-center gap-2">
										<CardTitle className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
											<span className="truncate">{plugin.name}</span>
											{!plugin.enabled && (
												<Badge variant="secondary">
													{t('settings.integrations.installed.disabled')}
												</Badge>
											)}
											{plugin.error && (
												<Badge variant="destructive">
													{t('settings.integrations.installed.unavailable')}
												</Badge>
											)}
										</CardTitle>
										<div
											className="flex shrink-0 items-center gap-1"
											onClick={(event) => event.stopPropagation()}
											onKeyDown={(event) => event.stopPropagation()}
										>
											{!plugin.core && (
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
														<DropdownMenuItem
															disabled={Boolean(plugin.error)}
															onSelect={() =>
																void run(() =>
																	window.plugins.setEnabled(plugin.id, !plugin.enabled)
																)
															}
														>
															{plugin.enabled ? <PowerOff /> : <Power />}
															{plugin.enabled
																? t('settings.integrations.installed.disable')
																: t('settings.integrations.installed.enableAction')}
														</DropdownMenuItem>
														{!plugin.builtIn && (
															<DropdownMenuItem onSelect={() => setPendingRemoval(plugin)}>
																<Trash2 />
																{t('settings.integrations.uninstall', { name: plugin.name })}
															</DropdownMenuItem>
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											)}
										</div>
									</div>
									<CardDescription className="line-clamp-1">
										{plugin.error ?? plugin.description}
									</CardDescription>
									<div className="flex items-center gap-3 text-xs text-muted-foreground">
										{plugin.author && (
											<span className="flex items-center gap-1">
												<User className="size-3" aria-hidden="true" />
												<span className="sr-only">{t('settings.integrations.plugin.author')}</span>
												{plugin.author}
											</span>
										)}
										{plugin.version && (
											<span className="flex items-center gap-1">
												<Tag className="size-3" aria-hidden="true" />
												<span className="sr-only">{t('settings.integrations.plugin.version')}</span>
												{plugin.version}
											</span>
										)}
									</div>
								</div>
							</CardHeader>
						</Card>
					))}
				</div>
			</section>
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
