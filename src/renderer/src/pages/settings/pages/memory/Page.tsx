import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemoryConfig, MemoryStatus } from '@shared/memory_types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { ModelOptions } from '@/components/model-options';
import { modelsFor, providerIdsFor, providerModels, providers } from '@/lib/providers';
import { updateModelOptions } from '@/lib/options';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import { initialModelConfigurationState } from '../../components/model-configuration-state';

export default function MemoryPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [config, setConfig] = useState<MemoryConfig | null>(null);
	const [status, setStatus] = useState<MemoryStatus | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const persistedConfig = useRef<string | null>(null);
	useEffect(() => {
		let mounted = true;
		void Promise.all([window.memory.getConfig(), window.memory.status()])
			.then(([next, progress]) => {
				if (!mounted) return;
				persistedConfig.current = JSON.stringify(next);
				setConfig(next);
				setStatus(progress);
			})
			.catch((failure: unknown) => {
				if (mounted) setError(String(failure));
			});
		const timer = setInterval(() => {
			void window.memory
				.status()
				.then((next) => {
					if (mounted) setStatus(next);
				})
				.catch((failure: unknown) => {
					if (mounted) setError(String(failure));
				});
		}, 3000);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	}, []);
	useEffect(() => {
		if (!config) return;
		const serialized = JSON.stringify(config);
		if (serialized === persistedConfig.current) return;
		let active = true;
		const timer = setTimeout(() => {
			setError(null);
			void window.memory
				.configure(config)
				.then((saved) => {
					if (!active) return;
					persistedConfig.current = JSON.stringify(saved);
					setConfig(saved);
				})
				.catch((failure: unknown) => {
					if (active) setError(failure instanceof Error ? failure.message : String(failure));
				});
		}, 400);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [config]);
	const run = async (operation: () => Promise<unknown>): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			await operation();
			setStatus(await window.memory.status());
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : String(failure));
		} finally {
			setBusy(false);
		}
	};
	const groups = providerIdsFor('llm').flatMap((id) => {
		const provider = providers().find((item) => item.id === id);
		const models = providerModels(id, 'llm');
		return provider && models.length ? [{ provider, models }] : [];
	});
	const selectedModel = modelsFor('llm').find(
		(model) => model.provider.id === config?.providerId && model.id === config?.modelId
	);
	const inputs =
		selectedModel?.metadata?.documentationStatus === 'verified'
			? selectedModel.metadata.inputs
			: {};
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.memory.title')}
				description={t('settings.memory.description')}
			/>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			{!config ? (
				<p role="status">{t('settings.memory.loading')}</p>
			) : (
				<>
					<fieldset disabled={busy} className="min-w-0 space-y-4">
						<SettingsPanel>
							<SettingsRow
								title={t('settings.memory.enabled')}
								description={t('settings.memory.enabledDescription')}
								actions={
									<Switch
										aria-label={t('settings.memory.enabled')}
										checked={config.enabled}
										onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
									/>
								}
							/>
							<ModelProviderConfiguration
								idPrefix="memory"
								triggerTitle={t('settings.memory.model')}
								description={t('settings.memory.modelDescription')}
								configState={{
									...initialModelConfigurationState,
									providers: groups.map((group) => group.provider),
									modelGroups: groups,
									providerId: config.providerId,
									modelId: config.modelId,
									loading: false,
									saving: busy,
								}}
								collapsible={false}
								onChange={(providerId, modelId) =>
									setConfig({ ...config, providerId, modelId, modelOptions: {} })
								}
							/>
							<div className="px-4 pb-4">
								<ModelOptions
									inputs={inputs}
									values={config.modelOptions}
									onChange={(path, value) =>
										setConfig({
											...config,
											modelOptions: updateModelOptions(config.modelOptions, path, value),
										})
									}
								/>
							</div>
							<SettingsRow
								title={t('settings.memory.type')}
								actions={
									<Select
										value={config.memoryType}
										onValueChange={(memoryType) =>
											setConfig({ ...config, memoryType: memoryType as MemoryConfig['memoryType'] })
										}
									>
										<SelectTrigger aria-label={t('settings.memory.type')} className="w-44">
											<SelectValue>{t(`settings.memory.${config.memoryType}`)}</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{(['facts', 'summaries', 'both'] as const).map((value) => (
												<SelectItem key={value} value={value}>
													{t(`settings.memory.${value}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								}
							/>
						</SettingsPanel>
					</fieldset>
					<SettingsSection
						title={t('settings.memory.processing')}
						action={
							<Button
								variant="outline"
								disabled={busy || status?.running || !config.providerId || !config.modelId}
								onClick={() => void run(() => window.memory.refresh())}
							>
								{t('settings.memory.generate')}
							</Button>
						}
					>
						<p role="status" className="text-sm text-muted-foreground">
							{t(status?.running ? 'settings.memory.running' : 'settings.memory.idle')} ·{' '}
							{t('settings.memory.pending', { count: status?.pending ?? 0 })}
						</p>
						<p className="text-sm text-muted-foreground">
							{t('settings.memory.lastSuccess')}:{' '}
							{status?.lastSuccess
								? new Date(status.lastSuccess).toLocaleString()
								: t('settings.memory.never')}
						</p>
						{status?.error && (
							<p role="alert" className="text-sm text-destructive">
								{status.error}
							</p>
						)}
					</SettingsSection>
				</>
			)}
		</SettingsPageShell>
	);
}
