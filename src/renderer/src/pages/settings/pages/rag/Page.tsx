import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FolderOpen, LoaderCircle, Search, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { RagMatch } from '../../../../../../main/agent/knowledge/rag';
import type { RagConfiguration } from '../../../../../../shared/rag_types';
import type { DatabaseConfiguration } from '../../../../../../shared/database_types';
import { databases, defaultProviderId, modelsFor } from '@/lib/providers';
import { getErrorMessage } from '../../../start/setupConstants';
import {
	SettingsLoadingRows,
	SettingsField,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { SETTINGS_SCHEDULES } from '../schedules';
import { DataControls } from '../../components/data';

const VALUE_SEPARATOR = '\u001F';

const RagPage: React.FC = () => {
	const { t } = useTranslation();
	const vectorDatabases = useMemo(() => databases(), []);
	const [databaseConfiguration, setDatabaseConfiguration] = useState<DatabaseConfiguration | null>(
		null
	);
	const [loadingDatabase, setLoadingDatabase] = useState(true);
	const [savingDatabase, setSavingDatabase] = useState(false);
	const embeddingModels = useMemo(() => modelsFor('embedding'), []);
	const [error, setError] = useState<string | null>(null);
	const [indexing, setIndexing] = useState(false);
	const [indexed, setIndexed] = useState<{ files: number; vectors: number } | null>(null);
	const [ragConfiguration, setRagConfiguration] = useState<RagConfiguration | null>(null);
	const [savingRagConfiguration, setSavingRagConfiguration] = useState(false);
	const [query, setQuery] = useState('');
	const [searching, setSearching] = useState(false);
	const [matches, setMatches] = useState<RagMatch[] | null>(null);
	const [embeddingProviderId, setEmbeddingProviderId] = useState('');
	const [embeddingModelId, setEmbeddingModelId] = useState('');
	const [loadingEmbeddingModel, setLoadingEmbeddingModel] = useState(true);
	const [savingEmbeddingModel, setSavingEmbeddingModel] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void Promise.all([
			window.models.embedding.getProviderId(),
			window.models.embedding.getModelId(),
		])
			.then(async ([storedProviderId, storedModelId]) => {
				if (cancelled) return;
				const stored = embeddingModels.find(
					(entry) => entry.provider.id === storedProviderId && entry.id === storedModelId
				);
				const fallbackProviderId = defaultProviderId('embedding');
				const fallback =
					embeddingModels.find((entry) => entry.provider.id === fallbackProviderId) ??
					embeddingModels[0];
				const selected = stored ?? fallback;
				setEmbeddingProviderId(selected?.provider.id ?? '');
				setEmbeddingModelId(selected?.id ?? '');
				if (selected && !stored) {
					await window.models.embedding.setProviderId(selected.provider.id);
					await window.models.embedding.setModelId(selected.id);
				}
			})
			.catch((err) => {
				if (!cancelled) setError(getErrorMessage(err, t('settings.rag.loadError')));
			})
			.finally(() => {
				if (!cancelled) setLoadingEmbeddingModel(false);
			});
		return () => {
			cancelled = true;
		};
	}, [embeddingModels, t]);

	useEffect(() => {
		let cancelled = false;
		void Promise.all([window.agent.ragGetConfiguration(), window.database.getConfiguration()]).then(
			([configuration, database]) => {
				if (!cancelled) {
					setRagConfiguration(configuration);
					setDatabaseConfiguration(database);
					setLoadingDatabase(false);
				}
			},
			(err) => {
				if (!cancelled) setError(getErrorMessage(err, t('settings.rag.loadError')));
			}
		);
		return () => {
			cancelled = true;
		};
	}, [t]);

	const handleIndex = async (): Promise<void> => {
		if (!canIndex || !ragConfiguration) return;
		setIndexing(true);
		setError(null);
		setIndexed(null);
		try {
			const saved = await saveRagConfiguration(ragConfiguration);
			if (!saved) return;
			setIndexed(await window.agent.ragIndex());
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim() ? err.message : t('settings.rag.indexError')
			);
		} finally {
			setIndexing(false);
		}
	};

	const saveRagConfiguration = async (
		next: RagConfiguration
	): Promise<RagConfiguration | undefined> => {
		setSavingRagConfiguration(true);
		setError(null);
		try {
			const saved = await window.agent.ragSaveConfiguration(next);
			setRagConfiguration(saved);
			return saved;
		} catch (err) {
			setError(getErrorMessage(err, t('settings.rag.saveError')));
			return undefined;
		} finally {
			setSavingRagConfiguration(false);
		}
	};

	const handleEnabledChange = (enabled: boolean): void => {
		if (!ragConfiguration) return;
		void saveRagConfiguration({ ...ragConfiguration, enabled });
	};

	const handleEmbeddingConsentChange = (enabled: boolean): void => {
		if (!ragConfiguration) return;
		void saveRagConfiguration({
			...ragConfiguration,
			embeddingConsent:
				enabled && embeddingProviderId && embeddingModelId
					? { providerId: embeddingProviderId, modelId: embeddingModelId, version: 1 }
					: null,
		});
	};

	const pickSourceFolder = async (): Promise<void> => {
		setError(null);
		try {
			const selected = await window.agent.ragPickFolder();
			if (selected && ragConfiguration) {
				await saveRagConfiguration({
					...ragConfiguration,
					folders: [...new Set([...ragConfiguration.folders, selected])],
				});
				setIndexed(null);
			}
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim() ? err.message : t('settings.rag.pickFolderError')
			);
		}
	};

	const handleSearch = async (): Promise<void> => {
		if (!query.trim() || !ragConfiguration?.indexName.trim()) return;
		setSearching(true);
		setError(null);
		setMatches(null);
		try {
			const saved = await saveRagConfiguration(ragConfiguration);
			if (!saved) return;
			setMatches(await window.agent.ragSearch(query));
		} catch (err) {
			setError(
				err instanceof Error && err.message.trim() ? err.message : t('settings.rag.searchError')
			);
		} finally {
			setSearching(false);
		}
	};

	const selectDatabase = async (value: string | null): Promise<void> => {
		if (!value) return;
		const [providerId, databaseId] = value.split(VALUE_SEPARATOR);
		const entry = vectorDatabases.find(
			(database) => database.provider.id === providerId && database.id === databaseId
		);
		if (!entry) return;
		setSavingDatabase(true);
		setError(null);
		try {
			const saved = await window.database.saveConfiguration({ providerId, databaseId });
			setDatabaseConfiguration(saved);
			setRagConfiguration(await window.agent.ragGetConfiguration());
		} catch (err) {
			setError(getErrorMessage(err, t('settings.rag.saveError')));
		} finally {
			setSavingDatabase(false);
		}
	};

	const selectEmbeddingModel = async (value: string | null): Promise<void> => {
		if (!value) return;
		const [providerId = '', modelId = ''] = value.split(VALUE_SEPARATOR);
		const entry = embeddingModels.find(
			(model) => model.provider.id === providerId && model.id === modelId
		);
		if (!entry) return;
		setEmbeddingProviderId(providerId);
		setEmbeddingModelId(modelId);
		setSavingEmbeddingModel(true);
		setError(null);
		try {
			await window.models.embedding.setProviderId(providerId);
			await window.models.embedding.setModelId(modelId);
		} catch (err) {
			setError(getErrorMessage(err, t('settings.rag.saveError')));
		} finally {
			setSavingEmbeddingModel(false);
		}
	};

	const selectedDatabase = vectorDatabases.find(
		(entry) =>
			entry.provider.id === databaseConfiguration?.providerId &&
			entry.id === databaseConfiguration?.databaseId
	);
	const databaseReady = Boolean(selectedDatabase) && !loadingDatabase && !savingDatabase;
	const selectedEmbeddingModel = embeddingModels.find(
		(entry) => entry.provider.id === embeddingProviderId && entry.id === embeddingModelId
	);
	const embeddingConsentMatches =
		ragConfiguration?.embeddingConsent?.version === 1 &&
		Boolean(ragConfiguration.embeddingConsent.recipient) &&
		ragConfiguration.embeddingConsent.providerId === embeddingProviderId &&
		ragConfiguration.embeddingConsent.modelId === embeddingModelId;
	const mirrorConsentMatches =
		databaseReady &&
		ragConfiguration?.mirrorConsent?.version === 1 &&
		Boolean(ragConfiguration.mirrorConsent.recipient) &&
		ragConfiguration.mirrorConsent.indexName === ragConfiguration.indexName;
	const indexingAuthorized =
		ragConfiguration?.enabled === true && embeddingConsentMatches && mirrorConsentMatches;
	const canIndex =
		indexingAuthorized &&
		databaseReady &&
		!indexing &&
		!savingRagConfiguration &&
		!loadingEmbeddingModel &&
		!savingEmbeddingModel &&
		Boolean(ragConfiguration?.folders.length && ragConfiguration.indexName.trim());
	const selectedSchedule = SETTINGS_SCHEDULES.find(
		(schedule) => schedule.cron === ragConfiguration?.cronExpression
	);
	const scheduleValue = !ragConfiguration?.scheduleEnabled
		? 'off'
		: (selectedSchedule?.key ?? 'custom');
	const scheduleLabel = selectedSchedule
		? t(`settings.rag.scheduleOptions.${selectedSchedule.key}`)
		: t(`settings.rag.scheduleOptions.${scheduleValue}`);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.rag.title')}
				description={t('settings.rag.description')}
			/>

			<SettingsSection title={t('settings.rag.behaviorTitle')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.rag.enabled')}
						description={t('settings.rag.enabledDescription')}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="ml-auto w-auto justify-end"
						actions={
							<Switch
								checked={ragConfiguration?.enabled === true}
								disabled={!ragConfiguration || savingRagConfiguration || indexing}
								aria-label={t('settings.rag.enabled')}
								onCheckedChange={handleEnabledChange}
							/>
						}
					/>
					<SettingsRow
						title={t('settings.rag.embeddingConsent')}
						description={t('settings.rag.embeddingConsentDescription')}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="ml-auto w-auto justify-end"
						actions={
							<Switch
								checked={embeddingConsentMatches}
								disabled={
									!ragConfiguration ||
									!embeddingProviderId ||
									!embeddingModelId ||
									loadingEmbeddingModel ||
									savingEmbeddingModel ||
									savingRagConfiguration ||
									indexing
								}
								aria-label={t('settings.rag.embeddingConsent')}
								onCheckedChange={handleEmbeddingConsentChange}
							/>
						}
					/>
					<SettingsRow
						title={t('settings.rag.mirrorConsent')}
						description={t('settings.rag.mirrorConsentDescription', {
							index: ragConfiguration?.indexName ?? '',
						})}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="ml-auto w-auto justify-end"
						actions={
							<Switch
								checked={mirrorConsentMatches}
								disabled={!ragConfiguration || !databaseReady || savingRagConfiguration || indexing}
								aria-label={t('settings.rag.mirrorConsent')}
								onCheckedChange={(enabled) => {
									if (ragConfiguration)
										void saveRagConfiguration({
											...ragConfiguration,
											mirrorConsent: enabled
												? { version: 1, indexName: ragConfiguration.indexName }
												: null,
										});
								}}
							/>
						}
					/>
				</SettingsPanel>
			</SettingsSection>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsSection title={t('settings.rag.configurationTitle')}>
				<SettingsPanel>
					<div className="grid gap-4 px-3 py-3">
						<SettingsField
							id="rag-vector-database"
							label={t('settings.rag.databaseTitle')}
							description={t('settings.rag.databaseDescription')}
						>
							<Select
								value={
									selectedDatabase
										? `${selectedDatabase.provider.id}${VALUE_SEPARATOR}${selectedDatabase.id}`
										: null
								}
								onValueChange={(value) => void selectDatabase(value)}
								disabled={loadingDatabase || savingDatabase || savingRagConfiguration || indexing}
							>
								<SelectTrigger
									id="rag-vector-database"
									size="sm"
									className="w-56 max-w-full text-xs"
								>
									<SelectValue placeholder={t('settings.rag.databasePlaceholder')}>
										{selectedDatabase &&
											`${selectedDatabase.provider.name} / ${selectedDatabase.name || selectedDatabase.id}`}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{vectorDatabases.map((entry) => (
										<SelectItem
											key={`${entry.provider.id}${VALUE_SEPARATOR}${entry.id}`}
											value={`${entry.provider.id}${VALUE_SEPARATOR}${entry.id}`}
										>
											{`${entry.provider.name} / ${entry.name || entry.id}`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SettingsField>

						<SettingsField
							id="rag-embedding-model"
							label={t('settings.rag.embeddingModelTitle')}
							description={t('settings.rag.embeddingModelDescription')}
						>
							{loadingEmbeddingModel ? (
								<SettingsLoadingRows rows={1} className="p-0" />
							) : embeddingModels.length === 0 ? (
								<SettingsNotice>{t('settings.modelServices.noModels')}</SettingsNotice>
							) : (
								<Select
									value={
										selectedEmbeddingModel
											? `${selectedEmbeddingModel.provider.id}${VALUE_SEPARATOR}${selectedEmbeddingModel.id}`
											: null
									}
									onValueChange={(value) => void selectEmbeddingModel(value)}
									disabled={savingEmbeddingModel || savingRagConfiguration || indexing}
								>
									<SelectTrigger
										id="rag-embedding-model"
										size="sm"
										className="w-56 max-w-full text-xs"
									>
										<SelectValue placeholder={t('settings.modelServices.modelPlaceholder')}>
											{selectedEmbeddingModel &&
												`${selectedEmbeddingModel.provider.name} / ${selectedEmbeddingModel.name || selectedEmbeddingModel.id}`}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{embeddingModels.map((entry) => (
											<SelectItem
												key={`${entry.provider.id}${VALUE_SEPARATOR}${entry.id}`}
												value={`${entry.provider.id}${VALUE_SEPARATOR}${entry.id}`}
											>
												{`${entry.provider.name} / ${entry.name || entry.id}`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</SettingsField>

						<SettingsField
							id="rag-index-name"
							label={t('settings.rag.indexName')}
							description={t('settings.rag.indexNameDescription')}
						>
							<Input
								id="rag-index-name"
								value={ragConfiguration?.indexName ?? ''}
								placeholder={t('settings.rag.indexNamePlaceholder')}
								maxLength={45}
								disabled={!ragConfiguration || indexing || savingRagConfiguration}
								onChange={(event) =>
									ragConfiguration &&
									setRagConfiguration({
										...ragConfiguration,
										indexName: event.target.value,
									})
								}
								onBlur={(event) =>
									ragConfiguration &&
									void saveRagConfiguration({
										...ragConfiguration,
										indexName: event.target.value,
									})
								}
							/>
						</SettingsField>
						<SettingsField
							id="rag-source-folders"
							label={t('settings.rag.sourceFolder')}
							description={t('settings.rag.documentsDescription')}
						>
							<div className="grid gap-2">
								{ragConfiguration?.folders.length ? (
									ragConfiguration.folders.map((folder) => (
										<div
											key={folder}
											className="flex min-w-0 items-center gap-2 rounded-md border border-border px-2 py-1.5"
										>
											<p className="min-w-0 flex-1 truncate text-xs" title={folder}>
												{folder}
											</p>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												disabled={indexing || savingRagConfiguration}
												aria-label={t('settings.rag.removeFolder')}
												onClick={() =>
													void saveRagConfiguration({
														...ragConfiguration,
														folders: ragConfiguration.folders.filter((entry) => entry !== folder),
													})
												}
											>
												<Trash2 className="size-3" />
											</Button>
										</div>
									))
								) : (
									<p className="text-[11px] leading-4 text-muted-foreground">
										{t('settings.rag.sourcePlaceholder')}
									</p>
								)}

								<div className="flex justify-end gap-2">
									<Button
										id="rag-source-folders"
										type="button"
										size="sm"
										variant="outline"
										aria-label={t('settings.rag.pickFolder')}
										disabled={indexing || savingRagConfiguration || !ragConfiguration}
										onClick={() => void pickSourceFolder()}
									>
										<FolderOpen className="size-3" />
										{t('settings.rag.pickFolder')}
									</Button>
								</div>
							</div>
						</SettingsField>

						{ragConfiguration && !indexingAuthorized && (
							<SettingsNotice>{t('settings.rag.indexRequirements')}</SettingsNotice>
						)}

						<div className="flex justify-end">
							<Button
								type="button"
								size="sm"
								disabled={!canIndex}
								onClick={() => void handleIndex()}
							>
								{indexing ? (
									<LoaderCircle className="size-3 animate-spin" />
								) : (
									<Sparkles className="size-3" />
								)}
								{indexing ? t('settings.rag.indexing') : t('settings.rag.index')}
							</Button>
						</div>

						{indexed && (
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.rag.indexResult', indexed)}
							</p>
						)}
					</div>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.rag.scheduleTitle')}>
				<SettingsPanel>
					<SettingsRow
						title={t('settings.rag.scheduleFrequency')}
						description={t('settings.rag.scheduleDescription')}
						actions={
							<Select
								value={ragConfiguration ? scheduleValue : null}
								disabled={!ragConfiguration || savingRagConfiguration}
								onValueChange={(value) => {
									if (!ragConfiguration || !value) return;
									if (value === 'off') {
										void saveRagConfiguration({
											...ragConfiguration,
											scheduleEnabled: false,
										});
										return;
									}
									const schedule = SETTINGS_SCHEDULES.find((entry) => entry.key === value);
									if (!schedule) return;
									void saveRagConfiguration({
										...ragConfiguration,
										scheduleEnabled: true,
										cronExpression: schedule.cron,
									});
								}}
							>
								<SelectTrigger
									size="sm"
									className="w-44 max-w-full text-xs"
									aria-label={t('settings.rag.scheduleFrequency')}
								>
									<SelectValue>{ragConfiguration && scheduleLabel}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="off">{t('settings.rag.scheduleOptions.off')}</SelectItem>
									{SETTINGS_SCHEDULES.map((schedule) => (
										<SelectItem key={schedule.key} value={schedule.key}>
											{t(`settings.rag.scheduleOptions.${schedule.key}`)}
										</SelectItem>
									))}
									{scheduleValue === 'custom' && (
										<SelectItem value="custom">
											{t('settings.rag.scheduleOptions.custom')}
										</SelectItem>
									)}
								</SelectContent>
							</Select>
						}
					/>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.rag.searchTitle')}>
				<SettingsPanel>
					<div className="grid gap-3 px-3 py-3">
						<Input
							value={query}
							placeholder={t('settings.rag.searchPlaceholder')}
							disabled={searching}
							onChange={(event) => setQuery(event.target.value)}
						/>

						<div className="flex justify-end">
							<Button
								type="button"
								size="sm"
								disabled={
									searching ||
									savingRagConfiguration ||
									!ragConfiguration?.indexName.trim() ||
									!query.trim()
								}
								onClick={() => void handleSearch()}
							>
								{searching ? (
									<LoaderCircle className="size-3 animate-spin" />
								) : (
									<Search className="size-3" />
								)}
								{searching ? t('settings.rag.searching') : t('settings.rag.search')}
							</Button>
						</div>

						{matches?.length === 0 && (
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.rag.noResults')}
							</p>
						)}

						{matches?.map((match) => (
							<div key={`${match.path}-${match.score}`} className="grid gap-0.5">
								<p className="truncate text-xs leading-4">
									{match.path} · {match.score.toFixed(3)}
								</p>
								<p className="line-clamp-3 text-[11px] leading-4 text-muted-foreground">
									{match.text}
								</p>
							</div>
						))}
					</div>
				</SettingsPanel>
			</SettingsSection>

			<SettingsSection title={t('settings.dataControls.title')}>
				<DataControls
					kinds={['local_index', 'local_namespace', 'remote_namespace', 'remote_all_namespaces']}
				/>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default RagPage;
