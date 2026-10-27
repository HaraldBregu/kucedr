import React, { useEffect, useState } from 'react';
import { Download, Search, Tag, User } from 'lucide-react';
import type { AvailablePlugin, PluginInfo } from '@shared/plugin_types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PluginIcon from '../../settings/pages/plugins/PluginIcon';
import { STEP_COPY } from '../setupConstants';
import { SetupStepHeader } from './SetupStepHeader';

export function SetupPluginsStep(): React.JSX.Element {
	const [tab, setTab] = useState<'installed' | 'download'>('installed');
	const [installed, setInstalled] = useState<PluginInfo[] | null>(null);
	const [available, setAvailable] = useState<AvailablePlugin[] | null>(null);
	const [installing, setInstalling] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [query, setQuery] = useState('');
	const matches = (text: string): boolean =>
		text.toLowerCase().includes(query.trim().toLowerCase());
	const filteredInstalled = installed?.filter((plugin) =>
		matches(`${plugin.name} ${plugin.description ?? ''}`)
	);
	const filteredAvailable = available?.filter((plugin) =>
		matches(`${plugin.title} ${plugin.description}`)
	);

	useEffect(() => {
		void Promise.all([window.plugins.list(), window.plugins.available()])
			.then(([nextInstalled, nextAvailable]) => {
				setInstalled(nextInstalled);
				setAvailable(nextAvailable);
			})
			.catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
	}, []);

	const install = async (plugin: AvailablePlugin): Promise<void> => {
		setInstalling(plugin.id);
		setError('');
		try {
			await window.plugins.installCatalog(plugin.id);
			const [nextInstalled, nextAvailable] = await Promise.all([
				window.plugins.list(),
				window.plugins.available(),
			]);
			setInstalled(nextInstalled);
			setAvailable(nextAvailable);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setInstalling(null);
		}
	};

	return (
		<div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col pt-8">
			<SetupStepHeader title={STEP_COPY.plugins.title} description={STEP_COPY.plugins.description} />
			{error && (
				<p
					className="mt-4 shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
				>
					{error}
				</p>
			)}
			<Tabs
				className="mt-6 min-h-0 flex-1"
				value={tab}
				onValueChange={(value) => setTab(value as 'installed' | 'download')}
			>
				<TabsList>
					<TabsTrigger value="installed">Installed</TabsTrigger>
					<TabsTrigger value="download">
						<Download />
						Download plugins
					</TabsTrigger>
				</TabsList>
				<div className="relative mt-2">
					<Search
						className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						type="search"
						className="pl-8"
						placeholder="Search plugins"
						aria-label="Search plugins"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
				<TabsContent value="installed" className="mt-2 min-h-0 overflow-y-auto pb-8">
					{filteredInstalled === undefined ? (
						<p className="text-sm text-muted-foreground">Loading plugins…</p>
					) : filteredInstalled.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{query ? 'No matching plugins.' : 'No plugins installed.'}
						</p>
					) : (
						<div className="grid gap-3">
							{filteredInstalled.map((plugin) => (
								<Card key={plugin.id} size="sm">
									<CardHeader className="flex items-center gap-3">
										<PluginIcon plugin={plugin} className="size-10" />
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<CardTitle className="truncate">{plugin.name}</CardTitle>
												<Badge variant="secondary">
													{plugin.builtIn ? 'Built-in' : 'Downloaded'}
												</Badge>
											</div>
											<CardDescription className="mt-1 line-clamp-1">
												{plugin.error ?? plugin.description}
											</CardDescription>
											<div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
												{plugin.author && (
													<span className="flex items-center gap-1">
														<User className="size-3" aria-hidden="true" />
														{plugin.author}
													</span>
												)}
												{plugin.version && (
													<span className="flex items-center gap-1">
														<Tag className="size-3" aria-hidden="true" />
														{plugin.version}
													</span>
												)}
											</div>
										</div>
									</CardHeader>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
				<TabsContent value="download" className="mt-2 min-h-0 overflow-y-auto pb-8">
					{filteredAvailable === undefined ? (
						<p className="text-sm text-muted-foreground">Loading plugins…</p>
					) : filteredAvailable.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{query ? 'No matching plugins.' : 'Every plugin in the catalog is installed.'}
						</p>
					) : (
						<div className="grid gap-3">
							{filteredAvailable.map((plugin) => (
								<Card key={plugin.id} size="sm">
									<CardHeader className="flex items-center gap-3">
										<PluginIcon plugin={plugin} className="size-10" />
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<CardTitle className="min-w-0 flex-1 truncate">{plugin.title}</CardTitle>
												<Button
													type="button"
													size="sm"
													disabled={installing !== null}
													onClick={() => void install(plugin)}
												>
													{installing === plugin.id ? 'Installing…' : plugin.update ? 'Update' : 'Install'}
												</Button>
											</div>
											<CardDescription className="mt-1 line-clamp-1">
												{plugin.description}
											</CardDescription>
											<div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<User className="size-3" aria-hidden="true" />
													{plugin.author}
												</span>
												<span className="flex items-center gap-1">
													<Tag className="size-3" aria-hidden="true" />
													{plugin.version}
												</span>
											</div>
										</div>
									</CardHeader>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
