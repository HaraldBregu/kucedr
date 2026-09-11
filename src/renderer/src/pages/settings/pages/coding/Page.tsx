import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type {
	CodingAuthEvent,
	CodingCatalog,
	CodingProviderId,
	CodingSettings,
	CodingThinkingLevel,
	CodingToolMode,
} from '../../../../../../shared/coding_types';
import { CODING_THINKING_LEVELS } from '../../../../../../shared/coding_types';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsValue,
} from '../../components';
import { firstErrorMessage } from '../../components/model-configuration-state';

const CodingPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [settings, setSettings] = useState<CodingSettings | null>(null);
	const [catalog, setCatalog] = useState<CodingCatalog>({ providers: [] });
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [authEvent, setAuthEvent] = useState<CodingAuthEvent | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		void Promise.all([window.coding.getSettings(), window.coding.listModels()])
			.then(([nextSettings, nextCatalog]) => {
				if (!mounted) return;
				setSettings(nextSettings);
				setCatalog(nextCatalog);
			})
			.catch((loadError) => {
				if (mounted) setError(firstErrorMessage(loadError, t('settings.coding.loadError')));
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [t]);

	const save = (nextSettings: CodingSettings): void => {
		setSettings(nextSettings);
		setSaving(true);
		setSaved(false);
		setError(null);
		void window.coding
			.saveSettings(nextSettings)
			.then((stored) => {
				setSettings(stored);
				setSaved(true);
			})
			.catch((saveError) => {
				setError(firstErrorMessage(saveError, t('settings.coding.saveError')));
			})
			.finally(() => setSaving(false));
	};

	const refreshCatalog = async (): Promise<void> => {
		setCatalog(await window.coding.listModels());
	};

	const handleProviderChange = (providerId: CodingProviderId): void => {
		if (!settings) return;
		const provider = catalog.providers.find((item) => item.id === providerId);
		const modelId = provider?.models.some((model) => model.id === settings.modelId)
			? settings.modelId
			: (provider?.models[0]?.id ?? '');
		save({ ...settings, providerId, modelId });
	};

	const handleConnect = (): void => {
		setConnecting(true);
		setAuthEvent(null);
		setError(null);
		void window.coding
			.connectCodex((event) => {
				setAuthEvent(event);
				if (event.type === 'device-code') {
					void window.app.openExternalUrl(event.verificationUri);
				} else if (event.type === 'auth-url') {
					void window.app.openExternalUrl(event.url);
				}
			})
			.then(refreshCatalog)
			.catch((connectError) => {
				setError(firstErrorMessage(connectError, t('settings.coding.connectError')));
			})
			.finally(() => setConnecting(false));
	};

	const handleDisconnect = (): void => {
		setConnecting(true);
		setError(null);
		void window.coding
			.disconnectCodex()
			.then(refreshCatalog)
			.catch((disconnectError) => {
				setError(firstErrorMessage(disconnectError, t('settings.coding.disconnectError')));
			})
			.finally(() => setConnecting(false));
	};

	const selectedProvider = catalog.providers.find(
		(provider) => provider.id === settings?.providerId
	);
	const selectedModel = selectedProvider?.models.find((model) => model.id === settings?.modelId);
	const deviceCode = authEvent?.type === 'device-code' ? authEvent : undefined;
	const authMessage = deviceCode
		? t('settings.coding.deviceCode')
		: authEvent && 'message' in authEvent
			? authEvent.message
			: authEvent?.type === 'auth-url'
				? (authEvent.instructions ?? t('settings.coding.completeLogin'))
				: null;
	const authUrl =
		authEvent?.type === 'device-code'
			? authEvent.verificationUri
			: authEvent?.type === 'auth-url'
				? authEvent.url
				: authEvent?.type === 'info'
					? authEvent.url
					: undefined;

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.coding.title')}
				description={t('settings.coding.description')}
				action={
					saving ? (
						<SettingsValue>{t('settings.coding.saving')}</SettingsValue>
					) : saved ? (
						<SettingsValue>{t('settings.coding.saved')}</SettingsValue>
					) : undefined
				}
			/>

			<SettingsNotice>{t('settings.coding.harnessExplanation')}</SettingsNotice>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsPanel>
				{loading || !settings ? (
					<SettingsLoadingRows rows={5} />
				) : (
					<>
						<SettingsRow
							title={t('settings.coding.runtime')}
							description={t('settings.coding.runtimeDescription')}
							actions={<SettingsValue>Pi SDK</SettingsValue>}
						/>

						<SettingsRow
							title={t('settings.coding.provider')}
							description={t('settings.coding.providerDescription')}
							actions={
								<Select
									value={settings.providerId}
									onValueChange={(value) => {
										if (value) handleProviderChange(value as CodingProviderId);
									}}
									disabled={saving}
								>
									<SelectTrigger
										className="w-56 max-w-full text-xs"
										aria-label={t('settings.coding.provider')}
									>
										<SelectValue>{selectedProvider?.name}</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{catalog.providers.map((provider) => (
											<SelectItem key={provider.id} value={provider.id}>
												{provider.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>

						<SettingsRow
							title={t('settings.coding.model')}
							description={t('settings.coding.modelDescription')}
							actions={
								<Select
									value={selectedModel?.id ?? null}
									onValueChange={(value) => {
										if (value) save({ ...settings, modelId: value });
									}}
									disabled={saving || !selectedProvider?.models.length}
								>
									<SelectTrigger
										className="w-56 max-w-full text-xs"
										aria-label={t('settings.coding.model')}
									>
										<SelectValue placeholder={t('settings.coding.selectModel')}>
											{selectedModel?.name}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{selectedProvider?.models.map((model) => (
											<SelectItem key={model.id} value={model.id}>
												{model.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>

						<SettingsRow
							title={t('settings.coding.authentication')}
							description={
								selectedProvider?.authentication === 'oauth'
									? t('settings.coding.codexAuthDescription')
									: t('settings.coding.apiKeyDescription')
							}
							actions={
								<>
									<Badge variant={selectedProvider?.configured ? 'secondary' : 'outline'}>
										{selectedProvider?.configured
											? t('settings.coding.connected')
											: t('settings.coding.notConnected')}
									</Badge>
									{settings.providerId === 'openai-codex' ? (
										selectedProvider?.configured ? (
											<Button
												size="xs"
												variant="outline"
												disabled={connecting}
												onClick={handleDisconnect}
											>
												{t('settings.coding.disconnect')}
											</Button>
										) : connecting ? (
											<Button
												size="xs"
												variant="outline"
												onClick={() => void window.coding.cancelCodexLogin()}
											>
												{t('settings.coding.cancel')}
											</Button>
										) : (
											<Button size="xs" onClick={handleConnect}>
												{t('settings.coding.connect')}
											</Button>
										)
									) : (
										<Button
											size="xs"
											variant="outline"
											onClick={() => navigate('/settings/providers/models')}
										>
											{t('settings.coding.manageApiKeys')}
										</Button>
									)}
								</>
							}
						/>

						<SettingsRow
							title={t('settings.coding.thinking')}
							description={t('settings.coding.thinkingDescription')}
							actions={
								<Select
									value={settings.thinkingLevel}
									onValueChange={(value) => {
										if (value) save({ ...settings, thinkingLevel: value as CodingThinkingLevel });
									}}
									disabled={saving}
								>
									<SelectTrigger
										className="w-40 max-w-full text-xs"
										aria-label={t('settings.coding.thinking')}
									>
										<SelectValue>
											{t(`settings.coding.thinkingLevels.${settings.thinkingLevel}`)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{CODING_THINKING_LEVELS.map((level) => (
											<SelectItem key={level} value={level}>
												{t(`settings.coding.thinkingLevels.${level}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>

						<SettingsRow
							title={t('settings.coding.tools')}
							description={t('settings.coding.toolsDescription')}
							actions={
								<Select
									value={settings.toolMode}
									onValueChange={(value) => {
										if (value) save({ ...settings, toolMode: value as CodingToolMode });
									}}
									disabled={saving}
								>
									<SelectTrigger
										className="w-40 max-w-full text-xs"
										aria-label={t('settings.coding.tools')}
									>
										<SelectValue>
											{settings.toolMode === 'coding'
												? t('settings.coding.codingTools')
												: t('settings.coding.readOnlyTools')}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="read-only">{t('settings.coding.readOnlyTools')}</SelectItem>
										<SelectItem value="coding">{t('settings.coding.codingTools')}</SelectItem>
									</SelectContent>
								</Select>
							}
						/>
					</>
				)}
			</SettingsPanel>

			{authMessage && (
				<SettingsNotice>
					<span className="flex flex-wrap items-center gap-2">
						<span>{authMessage}</span>
						{deviceCode && (
							<>
								<span className="basis-full text-muted-foreground">
									{t('settings.coding.deviceCodeHelp')}
								</span>
								<code className="select-all rounded-md border bg-muted px-2 py-1 font-mono text-sm font-semibold tracking-widest text-foreground">
									{deviceCode.userCode}
								</code>
								<Button
									size="xs"
									variant="outline"
									onClick={() => void navigator.clipboard.writeText(deviceCode.userCode)}
								>
									{t('settings.coding.copyCode')}
								</Button>
							</>
						)}
						{authUrl && (
							<Button
								size="xs"
								variant="outline"
								onClick={() => void window.app.openExternalUrl(authUrl)}
							>
								<ExternalLink />
								{t('settings.coding.openLogin')}
							</Button>
						)}
						{deviceCode && (
							<span className="text-muted-foreground">
								{t('settings.coding.waitingForAuthorization')}
							</span>
						)}
					</span>
				</SettingsNotice>
			)}

			{settings?.toolMode === 'coding' && (
				<SettingsNotice icon={ShieldAlert} variant="destructive">
					{t('settings.coding.toolWarning')}
				</SettingsNotice>
			)}

			{selectedProvider &&
				!selectedProvider.configured &&
				settings?.providerId !== 'openai-codex' && (
					<SettingsNotice icon={AlertTriangle}>
						{t('settings.coding.apiKeyMissing', { provider: selectedProvider.name })}
					</SettingsNotice>
				)}
		</SettingsPageShell>
	);
};

export default CodingPage;
