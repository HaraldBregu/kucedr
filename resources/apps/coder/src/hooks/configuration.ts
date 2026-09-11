import { useEffect, useState } from 'react';
import {
	app,
	coding,
	isKucedr,
	type CodingAuthEvent,
	type CodingCatalog,
	type CodingProviderId,
	type CodingSettings,
	type CodingThinkingLevel,
	type CodingToolMode,
} from '@kucedr/sdk';

const previewSettings: CodingSettings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: 'gpt-5.4',
	thinkingLevel: 'high',
	toolMode: 'coding',
};
const previewCatalog: CodingCatalog = {
	providers: [
		{
			id: 'openai-codex',
			name: 'OpenAI Codex',
			authentication: 'oauth',
			configured: true,
			models: [
				{
					id: 'gpt-5.4',
					name: 'GPT-5.4',
					reasoning: true,
					contextWindow: 200000,
				},
			],
		},
	],
};

export function useConfiguration() {
	const preview = !isKucedr();
	const [settings, setSettings] = useState<CodingSettings | null>(preview ? previewSettings : null);
	const [catalog, setCatalog] = useState<CodingCatalog>(
		preview ? previewCatalog : { providers: [] }
	);
	const [loading, setLoading] = useState(!preview);
	const [saving, setSaving] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [authEvent, setAuthEvent] = useState<CodingAuthEvent | null>(null);
	const [error, setError] = useState('');

	const refreshCatalog = async (): Promise<void> => {
		if (!preview) setCatalog(await coding.listModels());
	};
	const save = async (next: CodingSettings): Promise<void> => {
		setSettings(next);
		if (preview) return;
		setSaving(true);
		setError('');
		try {
			setSettings(await coding.saveSettings(next));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to save Coding settings.');
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		if (preview) return;
		let active = true;
		void Promise.all([coding.getSettings(), coding.listModels()])
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
	}, [preview]);

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
		if (preview) return;
		setConnecting(true);
		setAuthEvent(null);
		setError('');
		try {
			await coding.connectCodex((event) => {
				setAuthEvent(event);
				if (event.type === 'device-code') void app.openExternalUrl(event.verificationUri);
				if (event.type === 'auth-url') void app.openExternalUrl(event.url);
			});
			await refreshCatalog();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to connect Codex.');
		} finally {
			setConnecting(false);
		}
	};
	const disconnect = async (): Promise<void> => {
		if (preview) return;
		setConnecting(true);
		setError('');
		try {
			await coding.disconnectCodex();
			await refreshCatalog();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'Unable to disconnect Codex.');
		} finally {
			setConnecting(false);
		}
	};
	const cancelConnect = async (): Promise<void> => {
		if (!preview) await coding.cancelCodexLogin();
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
