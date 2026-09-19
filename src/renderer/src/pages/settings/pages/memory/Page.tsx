import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';
import type { MemoryConfig, MemoryEntry, MemoryStatus } from '@shared/memory_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
	const [entries, setEntries] = useState<MemoryEntry[]>([]);
	const [markdown, setMarkdown] = useState('');
	const [original, setOriginal] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let mounted = true;
		void Promise.all([
			window.memory.getConfig(),
			window.memory.status(),
			window.memory.list(),
			window.memory.read(),
		])
			.then(([next, progress, facts, text]) => {
				if (!mounted) return;
				setConfig(next);
				setStatus(progress);
				setEntries(facts);
				setMarkdown(text);
				setOriginal(text);
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
	const run = async (operation: () => Promise<unknown>, reload = false): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			await operation();
			if (reload) {
				const [facts, text] = await Promise.all([window.memory.list(), window.memory.read()]);
				setEntries(facts);
				setMarkdown(text);
				setOriginal(text);
			}
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
	const dirty = markdown !== original;
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.memory.title')}
				description={t('settings.memory.description')}
				icon={Brain}
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
							<SettingsRow
								title={t('settings.memory.schedule')}
								actions={
									<Switch
										aria-label={t('settings.memory.schedule')}
										checked={config.scheduleEnabled}
										onCheckedChange={(scheduleEnabled) => setConfig({ ...config, scheduleEnabled })}
									/>
								}
							/>
							<SettingsRow
								title={t('settings.memory.cron')}
								actions={
									<Input
										className="w-44"
										aria-label={t('settings.memory.cron')}
										disabled={!config.scheduleEnabled}
										value={config.cronExpression}
										onChange={(event) =>
											setConfig({ ...config, cronExpression: event.target.value })
										}
									/>
								}
							/>
							<SettingsRow
								title={t('settings.memory.timezone')}
								actions={
									<Input
										className="w-44"
										aria-label={t('settings.memory.timezone')}
										value={config.timezone}
										onChange={(event) => setConfig({ ...config, timezone: event.target.value })}
									/>
								}
							/>
						</SettingsPanel>
						<Button
							onClick={() => void run(async () => setConfig(await window.memory.configure(config)))}
						>
							{t('settings.memory.saveSettings')}
						</Button>
					</fieldset>
					<SettingsSection
						title={t('settings.memory.processing')}
						action={
							<Button
								variant="outline"
								disabled={busy || status?.running || dirty || !config.providerId || !config.modelId}
								onClick={() => void run(() => window.memory.refresh(), true)}
							>
								{t('settings.memory.refresh')}
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
					<SettingsSection
						title={t('settings.memory.content')}
						description={t('settings.memory.contentDescription')}
					>
						<Textarea
							aria-label={t('settings.memory.content')}
							className="min-h-60 font-mono text-sm"
							value={markdown}
							disabled={busy}
							onChange={(event) => setMarkdown(event.target.value)}
						/>
						<div className="flex flex-wrap gap-2">
							<Button
								disabled={busy || !dirty}
								onClick={() => void run(() => window.memory.edit(markdown, original), true)}
							>
								{t('settings.memory.saveContent')}
							</Button>
							<Button
								variant="destructive"
								disabled={busy || dirty || !original}
								onClick={() => {
									if (window.confirm(t('settings.memory.clearConfirm')))
										void run(() => window.memory.clear(), true);
								}}
							>
								{t('settings.memory.clear')}
							</Button>
						</div>
						{entries.map((entry) => (
							<SettingsRow
								key={entry.id}
								title={entry.fact}
								actions={
									<Button
										variant="ghost"
										disabled={busy || dirty}
										onClick={() => void run(() => window.memory.forget(entry.id), true)}
									>
										{t('settings.memory.forget')}
									</Button>
								}
							/>
						))}
					</SettingsSection>
				</>
			)}
		</SettingsPageShell>
	);
}
