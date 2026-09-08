import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, KeyRound, LoaderCircle, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { openExternalUrl } from '@/lib/external-links';
import { cn } from '@/lib/utils';
import {
	actionableProviderCatalog,
	getErrorMessage,
	MASKED_API_KEY_LABEL,
} from '../../../../start/setupConstants';
import type { ProviderCatalogItem, ProviderSetupEntry } from '../../../../start/setupTypes';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsSection,
} from '../../../components';

const ProvidersPage: React.FC = () => {
	const { t } = useTranslation();
	const [providerEntries, setProviderEntries] = useState<ProviderSetupEntry[]>(() =>
		actionableProviderCatalog().map((provider, index) => ({
			providerId: provider.id,
			apiKey: '',
			apiKeySaved: false,
			editing: index === 0,
		}))
	);
	const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		void window.provider
			.list('models')
			.then((storedProviders) => {
				if (cancelled) return;
				const savedStatus: Record<string, boolean> = Object.fromEntries(
					storedProviders.map((provider) => [provider.id, provider.configured])
				);
				const hasSavedProvider = actionableProviderCatalog().some(
					(provider) => savedStatus[provider.id]
				);

				setProviderEntries((currentEntries) =>
					actionableProviderCatalog().map((provider, index) => {
						const current = currentEntries.find((entry) => entry.providerId === provider.id);
						const draft = current?.apiKey ?? '';
						const hasDraft = draft.trim().length > 0;
						const saved = savedStatus[provider.id] ?? false;

						return {
							providerId: provider.id,
							apiKey: draft,
							apiKeySaved: saved,
							editing: hasDraft
								? (current?.editing ?? false)
								: saved
									? false
									: (current?.editing ?? (!hasSavedProvider && index === 0)),
						};
					})
				);
			})
			.catch((err) => {
				if (cancelled) return;
				setError(getErrorMessage(err, 'Could not check saved provider access.'));
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const updateProviderEntry = (providerId: string, patch: Partial<ProviderSetupEntry>): void => {
		setProviderEntries((currentEntries) =>
			currentEntries.map((entry) =>
				entry.providerId === providerId ? { ...entry, ...patch } : entry
			)
		);
	};

	const handleProviderApiKeyChange = (providerId: string, apiKey: string): void => {
		updateProviderEntry(providerId, { apiKey });
		setError(null);
	};

	const handleOpenProviderLink = (provider: ProviderCatalogItem): void => {
		if (!provider.apiConfigurationUrl) return;
		openExternalUrl(provider.apiConfigurationUrl);
	};

	const saveProviderEntry = async (providerId: string): Promise<void> => {
		const entry = providerEntries.find((item) => item.providerId === providerId);
		const apiKey = entry?.apiKey.trim() ?? '';
		if (!entry || !apiKey) return;

		setSavingProviderId(providerId);
		setError(null);
		try {
			await window.provider.set({ kind: 'models', id: providerId, apiKey });
			updateProviderEntry(providerId, { apiKey: '', apiKeySaved: true, editing: false });
		} catch (err) {
			setError(getErrorMessage(err, 'Could not save provider API key.'));
		} finally {
			setSavingProviderId(null);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.providers.apiKeysTitle')}
				description={t('settings.providers.apiKeysDescription')}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsSection title={t('settings.providers.registeredProviders')}>
				<div className="space-y-2">
					{actionableProviderCatalog().map((provider) => {
						const entry = providerEntries.find((item) => item.providerId === provider.id);
						const connected = entry?.apiKeySaved ?? false;
						const editing = entry?.editing ?? false;
						const savingThisProvider = savingProviderId === provider.id;
						const canSaveProvider =
							!!entry && !savingThisProvider && entry.apiKey.trim().length > 0;

						return (
							<Card
								key={provider.id}
								className={cn(
									'rounded-lg border-border bg-card py-0 shadow-none',
									editing && 'border-ring ring-2 ring-ring/20',
									!provider.supported && 'opacity-70'
								)}
							>
								<CardContent className="p-0">
									<div
										className={cn(
											'grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3.5',
											editing && 'pb-3'
										)}
									>
										<ProviderAvatar
											providerId={provider.id}
											name={provider.name}
											iconDarkUrl={provider.iconDarkUrl}
											iconLightUrl={provider.iconLightUrl}
										/>
										<div className="min-w-0 flex-1">
											<div className="flex min-w-0 items-center gap-1.5">
												<h2 className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
													{provider.name}
												</h2>
												<Button
													type="button"
													variant="ghost"
													size="icon-xs"
													className="size-5 text-muted-foreground hover:text-foreground"
													aria-label={`Open ${provider.name} API setup`}
													onClick={() => handleOpenProviderLink(provider)}
												>
													<ExternalLink className="size-3" />
												</Button>
											</div>
											<p className="truncate text-xs font-medium leading-tight text-muted-foreground">
												{connected ? MASKED_API_KEY_LABEL : provider.capabilities}
											</p>
										</div>
										<div className="flex shrink-0 justify-end gap-2">
											{provider.supported ? (
												connected && !editing ? (
													<Button
														type="button"
														variant="ghost"
														size="icon-xs"
														aria-label={`Edit ${provider.name} API key`}
														onClick={() =>
															updateProviderEntry(provider.id, {
																editing: true,
																apiKey: '',
															})
														}
													>
														<Pencil className="size-3.5" />
													</Button>
												) : editing ? null : (
													<Button
														type="button"
														variant="outline"
														size="xs"
														onClick={() => updateProviderEntry(provider.id, { editing: true })}
													>
														Connect
													</Button>
												)
											) : (
												<Button type="button" variant="outline" size="xs" disabled>
													Soon
												</Button>
											)}
										</div>
									</div>

									{provider.supported && editing && entry ? (
										<div className="flex items-center gap-2 px-4 pb-4">
											<Input
												aria-label={`${provider.name} API key`}
												autoComplete="off"
												className="h-8 flex-1 rounded-md border-input bg-card px-2.5 text-xs font-semibold placeholder:text-muted-foreground"
												disabled={savingThisProvider}
												onChange={(event) =>
													handleProviderApiKeyChange(provider.id, event.target.value)
												}
												onKeyDown={(event) => {
													if (event.key === 'Enter' && canSaveProvider) {
														void saveProviderEntry(provider.id);
													}
												}}
												placeholder={t('settings.providers.apiKeyPlaceholder')}
												spellCheck={false}
												type="password"
												value={entry.apiKey}
											/>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={savingThisProvider}
												onClick={() =>
													updateProviderEntry(provider.id, { apiKey: '', editing: false })
												}
											>
												{t('common.cancel')}
											</Button>
											<Button
												type="button"
												size="sm"
												disabled={!canSaveProvider}
												onClick={() => void saveProviderEntry(provider.id)}
											>
												{savingThisProvider ? (
													<LoaderCircle className="size-3.5 animate-spin" />
												) : null}
												{t('common.save')}
											</Button>
										</div>
									) : null}
								</CardContent>
							</Card>
						);
					})}
				</div>
			</SettingsSection>

			<SettingsNotice icon={KeyRound}>{t('settings.providers.localNote')}</SettingsNotice>
		</SettingsPageShell>
	);
};

export default ProvidersPage;
