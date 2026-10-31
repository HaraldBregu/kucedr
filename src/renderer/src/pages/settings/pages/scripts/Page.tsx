import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileCode, Folder, Layers, Plug, Tag, User } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { PluginScriptInfo } from '../../../../../../shared/plugin_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsFilter } from '../../components/filter';

const ScriptsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [scripts, setScripts] = useState<PluginScriptInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('all');
	const categories = useMemo(
		() => [...new Set(scripts.map((script) => script.category))].sort(),
		[scripts]
	);
	const visibleScripts = scripts.filter(
		(script) =>
			(category === 'all' || script.category === category) &&
			`${script.title} ${script.name}`.toLowerCase().includes(query.trim().toLowerCase())
	);

	useEffect(() => {
		window.plugins
			.scripts()
			.then(setScripts, () => setErrorMessage(t('settings.scripts.loadError')))
			.finally(() => setLoading(false));
	}, [t]);

	const open = (script: PluginScriptInfo): void => {
		void navigate(`/settings/scripts/${encodeURIComponent(script.name)}`);
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.scripts')}
				description={t('settings.scripts.description')}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			{!loading && scripts.length === 0 && (
				<SettingsEmptyState
					icon={FileCode}
					title={t('settings.scripts.empty')}
					description={t('settings.scripts.emptyDescription')}
				/>
			)}

			{(loading || scripts.length > 0) && (
				<section className="pb-4" aria-labelledby="installed-scripts-title">
					<h2 id="installed-scripts-title" className="mb-2 text-sm font-medium">
						{t('settings.scripts.title')}
					</h2>
					<SettingsFilter
						query={query}
						onQueryChange={setQuery}
						categories={categories}
						category={category}
						onCategoryChange={setCategory}
					/>
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{visibleScripts.map((script) => (
								<Card
									key={script.name}
									size="sm"
									{...(script.type === 'STORAGE' && {
										role: 'link',
										tabIndex: 0,
										className:
											'cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20',
										onClick: () => open(script),
										onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
											if (
												event.target === event.currentTarget &&
												(event.key === 'Enter' || event.key === ' ')
											) {
												event.preventDefault();
												open(script);
											}
										},
									})}
								>
									<CardHeader className="flex flex-1 items-center gap-3">
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<CardTitle className="truncate">{script.title}</CardTitle>
											<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<Layers className="size-3" aria-hidden="true" />
													{script.type}
												</span>
												<span className="flex items-center gap-1">
													<Folder className="size-3" aria-hidden="true" />
													{script.category}
												</span>
												<span className="flex items-center gap-1">
													<Tag className="size-3" aria-hidden="true" />
													<span className="sr-only">
														{t('settings.integrations.plugin.version')}
													</span>
													{script.version}
												</span>
												{script.author && (
													<span className="flex items-center gap-1">
														<User className="size-3" aria-hidden="true" />
														<span className="sr-only">
															{t('settings.integrations.plugin.author')}
														</span>
														{script.author}
													</span>
												)}
												<span className="flex items-center gap-1">
													<Plug className="size-3" aria-hidden="true" />
													<span className="sr-only">{t('settings.scripts.plugin')}</span>
													{script.plugin.name}
												</span>
											</div>
										</div>
										{script.type === 'STORAGE' && (
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
};

export default ScriptsPage;
