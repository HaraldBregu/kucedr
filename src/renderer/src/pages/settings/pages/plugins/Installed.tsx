import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Trash2 } from 'lucide-react';
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

export default function Installed({
	upload,
}: {
	readonly upload?: React.ReactNode;
}): React.JSX.Element {
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
			<section className="pb-4" aria-labelledby="installed-plugins-title">
				<h2 id="installed-plugins-title" className="mb-2 text-sm font-medium">
					{t('settings.integrations.installed.title')}
				</h2>
				<SettingsFilter
					query={query}
					onQueryChange={setQuery}
					categories={['builtIn', 'downloaded', ...categories]}
					category={category}
					onCategoryChange={setCategory}
				/>
				<div className="grid grid-cols-1 gap-3">
					{upload}
					{visible.map((plugin) => (
						<Card
							key={plugin.id}
							size="sm"
							role="link"
							tabIndex={0}
							className="h-22 cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
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
								<PluginIcon plugin={plugin} className="size-8" />
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
