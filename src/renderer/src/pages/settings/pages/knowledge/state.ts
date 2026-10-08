import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RagConfiguration } from '@shared/rag_types';
import { LOCAL_RAG_DATABASE_ID, LOCAL_RAG_DATABASE_PROVIDER_ID } from '@shared/rag_types';
import type { RagStatus } from '@shared/rag_status';
import type { VectorDatabaseService } from '@shared/database_types';
import type { RagMatch } from '../../../../../../main/agent/knowledge/rag';
import { modelsFor } from '@/lib/providers';
import { getErrorMessage } from '../../../start/setupConstants';

export const VALUE_SEPARATOR = '\u001F';
export const LOCAL_DATABASE_VALUE = `${LOCAL_RAG_DATABASE_PROVIDER_ID}${VALUE_SEPARATOR}${LOCAL_RAG_DATABASE_ID}`;
export type KnowledgeState = ReturnType<typeof useKnowledge>;

export default function useKnowledge() {
	const { t } = useTranslation();
	const [configuration, setConfiguration] = useState<RagConfiguration | null>(null);
	const [databases, setDatabases] = useState<readonly VectorDatabaseService[]>([]);
	const [status, setStatus] = useState<RagStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [indexing, setIndexing] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [searching, setSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [statusError, setStatusError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [matches, setMatches] = useState<RagMatch[] | null>(null);
	const mounted = useRef(true);
	const savingRef = useRef(false);
	const revision = useRef(0);
	const embeddingModels = useMemo(() => modelsFor('embedding'), []);
	const load = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		setStatusError(null);
		try {
			const [nextConfiguration, nextDatabases, nextStatus] = await Promise.all([
				window.agent.ragGetConfiguration(),
				window.database.list(),
				window.agent.ragGetStatus(),
			]);
			if (!mounted.current) return;
			setConfiguration(nextConfiguration);
			setDatabases(nextDatabases);
			setStatus(nextStatus);
		} catch (failure) {
			if (mounted.current) setError(getErrorMessage(failure, t('settings.knowledge.loadError')));
		} finally {
			if (mounted.current) setLoading(false);
		}
	}, [t]);
	useEffect(() => {
		mounted.current = true;
		void load();
		return () => {
			mounted.current = false;
		};
	}, [load]);
	useEffect(() => {
		if (!configuration) return;
		let cancelled = false;
		const timer = window.setInterval(() => {
			if (savingRef.current) return;
			const currentRevision = revision.current;
			void Promise.all([
				window.agent.ragGetConfiguration(),
				window.agent.ragGetStatus(),
			]).then(
				([nextConfiguration, nextStatus]) => {
					if (cancelled || currentRevision !== revision.current) return;
					setStatus(nextStatus);
					setStatusError(null);
					if (JSON.stringify(nextConfiguration) !== JSON.stringify(configuration)) {
						setConfiguration(nextConfiguration);
						setMatches(null);
					}
				},
				(failure) => {
					if (!cancelled && currentRevision === revision.current)
						setStatusError(getErrorMessage(failure, t('settings.knowledge.loadError')));
				}
			);
		}, 2_000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [configuration, t]);
	const running = indexing || status?.running === true;
	const disabled = loading || saving || running || searching;
	const selectedEmbeddingModel = embeddingModels.find(
		(model) =>
			model.provider.id === configuration?.embeddingProviderId &&
			model.id === configuration?.embeddingModelId
	);
	const localDatabase =
		configuration?.databaseProviderId === LOCAL_RAG_DATABASE_PROVIDER_ID &&
		configuration.databaseId === LOCAL_RAG_DATABASE_ID;
	const selectedDatabase = databases.find(
		(database) =>
			database.providerId === configuration?.databaseProviderId &&
			database.databaseId === configuration?.databaseId
	);
	const remoteDatabase = Boolean(selectedDatabase) && !localDatabase;
	const embeddingConsentMatches =
		configuration?.embeddingConsent?.version === 1 &&
		Boolean(configuration.embeddingConsent.recipient) &&
		configuration.embeddingConsent.providerId === configuration.embeddingProviderId &&
		configuration.embeddingConsent.modelId === configuration.embeddingModelId;
	const mirrorConsentMatches =
		remoteDatabase &&
		configuration?.mirrorConsent?.version === 1 &&
		Boolean(configuration.mirrorConsent.recipient) &&
		configuration.mirrorConsent.indexName === configuration.indexName;
	const requirement = !configuration?.enabled
		? 'enable'
		: !selectedEmbeddingModel
			? 'model'
			: !embeddingConsentMatches
				? 'embeddingConsent'
				: !localDatabase && !remoteDatabase
					? 'database'
					: remoteDatabase && !mirrorConsentMatches
						? 'mirrorConsent'
						: !configuration.folders.length
							? 'folders'
							: !configuration.indexName.trim()
								? 'indexName'
								: null;
	const canIndex = !disabled && requirement === null;
	const currentIndex =
		status?.index && status.index.indexName === configuration?.indexName ? status.index : null;
	const indexModelMatches =
		currentIndex?.providerId === configuration?.embeddingProviderId &&
		currentIndex?.modelId === configuration?.embeddingModelId;
	const canSearch =
		!disabled &&
		!status?.requiresIndexing &&
		configuration?.enabled === true &&
		embeddingConsentMatches &&
		Boolean(selectedEmbeddingModel && currentIndex && indexModelMatches && query.trim());
	const save = async (patch: Partial<RagConfiguration>): Promise<void> => {
		if (!configuration || disabled || savingRef.current) return;
		savingRef.current = true;
		revision.current += 1;
		setSaving(true);
		setError(null);
		try {
			const next = await window.agent.ragSaveConfiguration({ ...configuration, ...patch });
			if (!mounted.current) return;
			setConfiguration(next);
			setMatches(null);
			await window.agent.ragGetStatus().then(
				(nextStatus) => {
					if (mounted.current) {
						setStatus(nextStatus);
						setStatusError(null);
					}
				},
				(failure) => {
					if (mounted.current)
						setStatusError(getErrorMessage(failure, t('settings.knowledge.loadError')));
				}
			);
		} catch (failure) {
			if (mounted.current) setError(getErrorMessage(failure, t('settings.knowledge.saveError')));
		} finally {
			savingRef.current = false;
			if (mounted.current) setSaving(false);
		}
	};
	const pickFolder = async (): Promise<void> => {
		if (!configuration || disabled) return;
		setError(null);
		try {
			const folder = await window.agent.ragPickFolder();
			if (folder && mounted.current)
				await save({ folders: [...new Set([...configuration.folders, folder])] });
		} catch (failure) {
			if (mounted.current)
				setError(getErrorMessage(failure, t('settings.knowledge.pickFolderError')));
		}
	};
	const runIndex = async (): Promise<void> => {
		if (!canIndex) return;
		setIndexing(true);
		setError(null);
		try {
			await window.agent.ragIndex();
		} catch (failure) {
			if (mounted.current) setError(getErrorMessage(failure, t('settings.knowledge.indexError')));
		} finally {
			if (mounted.current) {
				setIndexing(false);
				void window.agent.ragGetStatus().then(
					(next) => {
						if (mounted.current) setStatus(next);
					},
					(failure) => {
						if (mounted.current)
							setStatusError(getErrorMessage(failure, t('settings.knowledge.loadError')));
					}
				);
			}
		}
	};
	const cancelIndex = async (): Promise<void> => {
		if (!running || cancelling) return;
		setCancelling(true);
		try {
			await window.agent.ragCancelIndex();
		} catch (failure) {
			if (mounted.current) setError(getErrorMessage(failure, t('settings.knowledge.cancelError')));
		} finally {
			if (mounted.current) setCancelling(false);
		}
	};
	const search = async (): Promise<void> => {
		if (!canSearch) return;
		setSearching(true);
		setError(null);
		setMatches(null);
		try {
			const next = await window.agent.ragSearch(query.trim());
			if (mounted.current) setMatches(next);
		} catch (failure) {
			if (mounted.current) setError(getErrorMessage(failure, t('settings.knowledge.searchError')));
		} finally {
			if (mounted.current) setSearching(false);
		}
	};
	return {
		configuration,
		databases,
		status,
		loading,
		error: error ?? statusError,
		disabled,
		running,
		cancelling,
		searching,
		embeddingModels,
		selectedEmbeddingModel,
		localDatabase,
		remoteDatabase,
		selectedDatabase,
		embeddingConsentMatches,
		mirrorConsentMatches,
		requirement,
		canIndex,
		currentIndex,
		indexModelMatches,
		canSearch,
		query,
		matches,
		load,
		save,
		pickFolder,
		runIndex,
		cancelIndex,
		setQuery,
		search,
	};
}
