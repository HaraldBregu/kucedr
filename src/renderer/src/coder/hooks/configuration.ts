import { useEffect, useRef, useState } from 'react';
import type {
	CodingAuthEvent,
	CodingCatalog,
	CodingProviderId,
	CodingSettings,
	CodingThinkingLevel,
	CodingToolMode,
} from '@shared/coding_types';

export function useConfiguration() {
	const [settings, setSettings] = useState<CodingSettings | null>(null);
	const [catalog, setCatalog] = useState<CodingCatalog>({ providers: [] });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);
	const [connecting, setConnecting] = useState(false);
	const [authEvent, setAuthEvent] = useState<CodingAuthEvent | null>(null);
	const [error, setError] = useState('');

	const save = async (next: CodingSettings): Promise<void> => {
		if (savingRef.current) return;
		savingRef.current = true;
		setSaving(true);
		setError('');
		try {
			setSettings(await window.coding.saveSettings(next));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to save Coder settings.');
		} finally {
			savingRef.current = false;
			setSaving(false);
		}
	};

	useEffect(() => {
		let active = true;
		void Promise.all([window.coding.getSettings(), window.coding.listModels()])
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
	}, []);

	const setProvider = (providerId: CodingProviderId): void => {
		if (!settings) return;
		const provider = catalog.providers.find((item) => item.id === providerId);
		const modelId = provider?.models.some((model) => model.id === settings.modelId)
			? settings.modelId
			: (provider?.models[0]?.id ?? '');
		void save({ ...settings, providerId, modelId });
	};
	const setModel = (modelId: string): void => {
		if (settings) void save({ ...settings, modelId });
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
			await window.coding.connectCodex((event) => {
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
			});
			setCatalog(await window.coding.listModels());
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
			await window.coding.disconnectCodex();
			setCatalog(await window.coding.listModels());
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to disconnect Codex.');
		} finally {
			setConnecting(false);
		}
	};
	const cancelConnect = async (): Promise<void> => {
		try {
			await window.coding.cancelCodexLogin();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to cancel sign-in.');
		}
	};

	const selectedProvider = catalog.providers.find((item) => item.id === settings?.providerId);
	return {
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
