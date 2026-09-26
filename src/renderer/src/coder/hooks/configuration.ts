import { useEffect, useRef, useState } from 'react';
import type {
	CodingAuthEvent,
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
	const [connecting, setConnecting] = useState(false);
	const [authEvent, setAuthEvent] = useState<CodingAuthEvent | null>(null);
	const [error, setError] = useState('');
	const [apiKey, setApiKey] = useState('');

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
		setApiKey('');
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
	const saveKey = async () => {
		if (!settings || !apiKey.trim()) return;
		setSaving(true);
		try {
			await window.coder.setApiKey(
				settings.runtime === 'claude' || settings.providerId === 'anthropic'
					? 'anthropic'
					: 'openai',
				apiKey.trim(),
				settings.runtime
			);
			setApiKey('');
			setCatalog(await window.coder.listModels(settings.runtime));
		} catch (reason) {
			setError(String(reason));
		} finally {
			setSaving(false);
		}
	};
	const removeKey = async () => {
		if (!settings) return;
		setSaving(true);
		try {
			await window.coder.setApiKey(
				settings.providerId === 'anthropic' ? 'anthropic' : 'openai',
				'',
				settings.runtime
			);
			setCatalog(await window.coder.listModels(settings.runtime));
		} catch (reason) {
			setError(String(reason));
		} finally {
			setSaving(false);
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
	const connect = async (): Promise<void> => {
		setConnecting(true);
		setAuthEvent(null);
		setError('');
		try {
			await window.coder.connectCodex((event) => {
				setAuthEvent(event);
				const url =
					event.type === 'device-code'
						? event.verificationUri
						: event.type === 'auth-url'
							? event.url
							: null;
				if (url)
					void window.app.openExternalUrl(url).catch((reason) => {
						setError(reason instanceof Error ? reason.message : 'Unable to open sign-in page.');
					});
			}, settings?.runtime);
			setCatalog(await window.coder.listModels(settings?.runtime));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to connect Codex.');
		} finally {
			setConnecting(false);
			setAuthEvent(null);
		}
	};
	const disconnect = async (): Promise<void> => {
		setConnecting(true);
		setError('');
		try {
			await window.coder.disconnectCodex(settings?.runtime);
			setCatalog(await window.coder.listModels(settings?.runtime));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to disconnect Codex.');
		} finally {
			setConnecting(false);
		}
	};
	const cancelConnect = async (): Promise<void> => {
		try {
			await window.coder.cancelCodexLogin();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to cancel sign-in.');
		}
	};

	const selectedProvider = catalog.providers.find((item) => item.id === settings?.providerId);
	return {
		apiKey,
		setApiKey,
		saveKey,
		removeKey,
		setHarness,
		chooseDirectory,
		authEvent,
		catalog,
		connecting,
		error,
		loading,
		saving,
		settings,
		selectedProvider,
		connect,
		cancelConnect,
		disconnect,
		setModel,
		setProvider,
		setThinking,
		setTools,
	};
}
