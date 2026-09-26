import { useEffect, useRef, useState } from 'react';
import type {
	CodingCatalog,
	CodingProviderId,
	CodingSettings,
	CodingThinkingLevel,
	CodingToolMode,
} from '@shared/coding_types';

export function useConfiguration(
	initial?: CodingSettings | null,
	session?: { projectId: string; id: string },
	defaults = false
) {
	const [settings, setSettings] = useState<CodingSettings | null>(null);
	const [catalog, setCatalog] = useState<CodingCatalog>({ providers: [] });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);
	const [error, setError] = useState('');

	const save = async (next: CodingSettings): Promise<void> => {
		if (savingRef.current) return;
		savingRef.current = true;
		setSaving(true);
		setError('');
		try {
			if (session && !defaults) {
				const saved = await window.coder.saveSessionSettings(session.projectId, session.id, next);
				setSettings(saved.settings ?? next);
			} else setSettings(await window.coder.saveSettings(next));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to save Coder settings.');
		} finally {
			savingRef.current = false;
			setSaving(false);
		}
	};

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError('');
		void Promise.all([
			session && !defaults
				? window.coder
						.getSession(session.projectId, session.id)
						.then(
							(value) =>
								value.session.settings ?? initial ?? window.coder.getSettings(value.session.runtime)
						)
				: window.coder.getSettings(initial?.runtime),
			window.coder.listModels(initial?.runtime),
		])
			.then(([nextSettings, nextCatalog]) => {
				if (!active) return;
				setSettings(nextSettings);
				setCatalog(nextCatalog);
			})
			.catch((reason) => {
				if (active) setError(reason instanceof Error ? reason.message : 'Unable to load settings.');
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [initial, defaults, session]);

	const setHarness = async (runtime: CodingSettings['runtime']) => {
		setLoading(true);
		setError('');
		try {
			const [next, models] = await Promise.all([
				window.coder.getSettings(runtime),
				window.coder.listModels(runtime),
			]);
			setSettings(next);
			setCatalog(models);
		} catch (reason) {
			setError(String(reason));
		} finally {
			setLoading(false);
		}
	};
	const chooseDirectory = async () => {
		try {
			const workingDirectory = await window.coder.pickDirectory();
			if (workingDirectory && settings) await save({ ...settings, workingDirectory });
		} catch (reason) {
			setError(String(reason));
		}
	};
	const setProvider = (providerId: CodingProviderId): void => {
		if (!settings) return;
		const provider = catalog.providers.find((item) => item.id === providerId);
		const modelId = provider?.models.some((model) => model.id === settings.modelId)
			? settings.modelId
			: (provider?.models[0]?.id ?? '');
		const levels = provider?.models.find((model) => model.id === modelId)?.thinkingLevels;
		const thinkingLevel =
			levels?.length && !levels.includes(settings.thinkingLevel)
				? levels[0]
				: settings.thinkingLevel;
		void save({ ...settings, providerId, modelId, thinkingLevel });
	};
	const setModel = (modelId: string): void => {
		if (!settings) return;
		const levels = catalog.providers
			.find((provider) => provider.id === settings.providerId)
			?.models.find((model) => model.id === modelId)?.thinkingLevels;
		const thinkingLevel =
			levels?.length && !levels.includes(settings.thinkingLevel)
				? levels[0]
				: settings.thinkingLevel;
		void save({ ...settings, modelId, thinkingLevel });
	};
	const setThinking = (thinkingLevel: CodingThinkingLevel): void => {
		if (settings) void save({ ...settings, thinkingLevel });
	};
	const setTools = (toolMode: CodingToolMode): void => {
		if (settings) void save({ ...settings, toolMode });
	};
	const refreshCatalog = async (runtime: CodingSettings['runtime']) => {
		setCatalog(await window.coder.listModels(runtime));
	};

	const selectedProvider = catalog.providers.find((item) => item.id === settings?.providerId);
	return {
		setHarness,
		chooseDirectory,
		catalog,
		error,
		loading,
		saving,
		settings,
		selectedProvider,
		refreshCatalog,
		setModel,
		setProvider,
		setThinking,
		setTools,
	};
}
