import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Pin, Plug, SquareSlash, ToggleRight } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentModeInfo } from '../../../../../../shared/agent_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsFilter } from '../../components/filter';

const ModesPage: React.FC = () => {
	const { t } = useTranslation();
	const [modes, setModes] = useState<AgentModeInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');
	const [query, setQuery] = useState('');
	const visibleModes = modes.filter((mode) =>
		`${mode.title} ${mode.command}`.toLowerCase().includes(query.trim().toLowerCase())
	);

	useEffect(() => {
		window.agent
			.listModes()
			.then(setModes, () => setErrorMessage(t('settings.modes.loadError')))
			.finally(() => setLoading(false));
	}, [t]);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.modes')}
				description={t('settings.modes.description')}
			/>

			<SettingsFilter query={query} onQueryChange={setQuery} />

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			{!loading && modes.length === 0 && (
				<SettingsEmptyState
					icon={ToggleRight}
					title={t('settings.modes.empty')}
					description={t('settings.modes.emptyDescription')}
				/>
			)}

			{(loading || modes.length > 0) && (
				<section className="pb-4">
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{visibleModes.map((mode) => (
								<Card key={mode.id} size="sm">
									<CardHeader className="flex flex-1 items-center gap-3">
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<CardTitle className="truncate">{mode.title}</CardTitle>
											<CardDescription>{mode.description}</CardDescription>
											<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<SquareSlash className="size-3" aria-hidden="true" />
													<span className="sr-only">{t('settings.modes.command')}</span>
													{mode.command}
												</span>
												{mode.persistent && (
													<span className="flex items-center gap-1">
														<Pin className="size-3" aria-hidden="true" />
														{t('settings.modes.persistent')}
													</span>
												)}
												<span className="flex items-center gap-1">
													<Plug className="size-3" aria-hidden="true" />
													<span className="sr-only">{t('settings.modes.plugin')}</span>
													{mode.plugin}
												</span>
											</div>
										</div>
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

export default ModesPage;
