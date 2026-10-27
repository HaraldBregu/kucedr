import React, { useEffect, useState } from 'react';
import { Download, Tag, User } from 'lucide-react';
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
		<div className="mx-auto flex min-h-full w-full max-w-3xl flex-col py-8">
			<SetupStepHeader title={STEP_COPY.plugins.title} description={STEP_COPY.plugins.description} />
			{error && (
				<p
					className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
				>
					{error}
				</p>
			)}
			<Tabs
				className="mt-6"
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
				<TabsContent value="installed" className="mt-4">
					{installed === null ? (
						<p className="text-sm text-muted-foreground">Loading plugins…</p>
					) : installed.length === 0 ? (
						<p className="text-sm text-muted-foreground">No plugins installed.</p>
					) : (
						<div className="grid gap-3">
							{installed.map((plugin) => (
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
				<TabsContent value="download" className="mt-4">
					{available === null ? (
						<p className="text-sm text-muted-foreground">Loading plugins…</p>
					) : available.length === 0 ? (
						<p className="text-sm text-muted-foreground">Every plugin in the catalog is installed.</p>
					) : (
						<div className="grid gap-3">
							{available.map((plugin) => (
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
