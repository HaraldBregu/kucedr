import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	ChevronRight,
	CircleCheck,
	CircleOff,
	Layers,
	Plug,
	ServerCog,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { CatalogWebSearch } from '@shared/provider_types';
import type { SearchEngineId, SearchSettings } from '@shared/search_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsFilter } from '../../components/filter';

const ServicesPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [services, setServices] = useState<CatalogWebSearch[]>([]);
	const [settings, setSettings] = useState<SearchSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');
	const filter = useSettingsFilter(services, {
		text: (service) =>
			`${service.name} ${service.type} ${service.provider.name} ${service.provider.plugin?.name ?? ''}`,
		category: (service) => service.type,
	});

	useEffect(() => {
		Promise.all([window.services.list(), window.search.getSettings()])
			.then(
				([list, searchSettings]) => {
					setServices(list);
					setSettings(searchSettings);
				},
				() => setErrorMessage(t('settings.services.loadError'))
			)
			.finally(() => setLoading(false));
	}, [t]);

	const open = (service: CatalogWebSearch): void => {
		void navigate(
			`/settings/services/${encodeURIComponent(service.provider.id)}/${encodeURIComponent(service.id)}`
		);
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.services')}
				description={t('settings.services.description')}
			/>

			<SettingsFilter
				query={query}
				onQueryChange={setQuery}
				categories={types}
				category={type}
				onCategoryChange={setType}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			{!loading && services.length === 0 && (
				<SettingsEmptyState
					icon={ServerCog}
					title={t('settings.services.empty')}
					description={t('settings.services.emptyDescription')}
				/>
			)}

			{(loading || services.length > 0) && (
				<section className="pb-4">
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{visibleServices.map((service) => {
								const configured =
									settings?.configured[service.provider.id as SearchEngineId] ?? false;
								return (
									<Card
										key={`${service.provider.id}/${service.id}`}
										size="sm"
										role="link"
										tabIndex={0}
										className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
										onClick={() => open(service)}
										onKeyDown={(event) => {
											if (
												event.target === event.currentTarget &&
												(event.key === 'Enter' || event.key === ' ')
											) {
												event.preventDefault();
												open(service);
											}
										}}
									>
										<CardHeader className="flex flex-1 items-center gap-3">
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<CardTitle className="truncate">{service.name}</CardTitle>
												<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
													<span className="flex items-center gap-1">
														<Layers className="size-3" aria-hidden="true" />
														{service.type}
													</span>
													<span className="flex items-center gap-1">
														{configured ? (
															<CircleCheck className="size-3" aria-hidden="true" />
														) : (
															<CircleOff className="size-3" aria-hidden="true" />
														)}
														{t(
															configured
																? 'settings.providers.configured'
																: 'settings.providers.notConfigured'
														)}
													</span>
													<span className="flex items-center gap-1">
														<Plug className="size-3" aria-hidden="true" />
														<span className="sr-only">{t('settings.services.plugin')}</span>
														{service.provider.plugin?.name ?? service.provider.name}
													</span>
												</div>
											</div>
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
										</CardHeader>
									</Card>
								);
							})}
						</div>
					)}
				</section>
			)}
		</SettingsPageShell>
	);
};

export default ServicesPage;
