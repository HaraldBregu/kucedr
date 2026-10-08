import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
	AlertTriangle,
	BrainCircuit,
	Calendar as CalendarIcon,
	ChevronRight,
	Wrench,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { ModelOptions } from '@/components/model-options';
import { updateModelOptions } from '@/lib/options';
import { providerIdsFor, providerModels, providers } from '@/lib/providers';
import type { ProviderModelGroup } from '@pages/start/setupTypes';
import {
	SettingsLoadingRows,
	SettingsAutoDismiss,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../../components';
import { ModelProviderConfiguration } from '../../../components/model-configuration';

function llmModelGroups(): ProviderModelGroup[] {
	return providerIdsFor('llm').flatMap((providerId) => {
		const provider = providers().find((item) => item.id === providerId);
		const models = providerModels(providerId, 'llm');
		return provider && models.length > 0 ? [{ provider, models }] : [];
	});
}

type HealthSettings = Awaited<ReturnType<typeof window.agent.healthGetSettings>>;

const HealthPage: React.FC = () => {
	const { t } = useTranslation();
	const [cronDraft, setCronDraft] = useState<string>();
	const [settings, setSettings] = useState<HealthSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

	useEffect(() => {
		let mounted = true;
		void window.agent
			.healthGetSettings()
			.then((result) => {
				if (!mounted) return;
				setSettings(result);
			})
			.catch((err: unknown) => {
				if (mounted) setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, []);

	const updateAndSave = (patch: Partial<HealthSettings>): void => {
		if (!settings) return;
		const previous = settings;
		setSettings((current) => (current ? { ...current, ...patch } : current));
		setSaving(true);
		setSaved(false);
		setError(null);
		void window.agent
			.healthSaveSettings(patch)
			.then(() => {
				if (patch.cronExpression !== undefined) setCronDraft(undefined);
				setSaved(true);
			})
			.catch((err: unknown) => {
				setSettings((current) => {
					if (!current) return current;
					const restored = { ...current };
					for (const key of Object.keys(patch) as (keyof HealthSettings)[]) {
						if (current[key] === patch[key]) Object.assign(restored, { [key]: previous[key] });
					}
					return restored;
				});
				setError(err instanceof Error ? err.message : t('settings.health.errors.saveFailed'));
			})
			.finally(() => {
				setSaving(false);
			});
	};

	const modelGroups = llmModelGroups();
	const selectedModel = modelGroups
		.find((group) => group.provider.id === settings?.providerId)
		?.models.find((model) => model.id === settings?.modelId);
	const inputs =
		selectedModel?.metadata?.documentationStatus === 'verified'
			? selectedModel.metadata.inputs
			: {};
	const targetOptions =
		settings && settings.target !== 'none' && settings.target !== 'last'
			? (['none', 'last', settings.target] as const)
			: (['none', 'last'] as const);
	const updateModelOption = (path: readonly string[], value: unknown): void => {
		updateAndSave({ modelOptions: updateModelOptions(settings?.modelOptions ?? {}, path, value) });
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.health')}
				description={t('settings.overview.descriptions.health')}
			/>

			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			{loading || !settings ? (
				<SettingsLoadingRows rows={3} />
			) : (
				<>
					<SettingsPanel>
						<ModelProviderConfiguration
							configState={{
								providers: modelGroups.map((group) => group.provider),
								modelGroups,
								providerId: settings.providerId ?? '',
								modelId: settings.modelId ?? '',
								loading: false,
								loadingModels: false,
								saving,
								saved,
								error: null,
							}}
							idPrefix="health"
							triggerTitle={t('settings.modelServices.llmModel')}
							description={t('settings.modelServices.modelDescription')}
							showIcon
							icon={BrainCircuit}
							showFieldLabel={false}
							grouped
							showSelectedModel
							buttonDropdown
							showContentSeparator={false}
							onChange={(providerId, modelId) =>
								updateAndSave({ providerId, modelId, modelOptions: {} })
							}
						>
							<div className="-mx-4">
								<SettingsRow
									title={t('settings.health.fields.target')}
									actions={
										<Select
											value={settings.target}
											onValueChange={(value) => updateAndSave({ target: value ?? 'none' })}
											disabled={saving}
										>
											<SelectTrigger id="health-target" className="h-7 w-44 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{targetOptions.map((option) => (
													<SelectItem key={option} value={option}>
														{option === 'none'
															? t('settings.health.fields.targetNone')
															: option === 'last'
																? t('settings.health.fields.targetLast')
																: option}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									}
								/>

								<SettingsRow
									title={t('settings.health.fields.directPolicy')}
									actions={
										<Select
											value={settings.directPolicy}
											onValueChange={(value) =>
												updateAndSave({
													directPolicy: (value ?? 'allow') as HealthSettings['directPolicy'],
												})
											}
											disabled={saving}
										>
											<SelectTrigger id="health-direct-policy" className="h-7 w-44 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="allow">
													{t('settings.health.fields.directAllow')}
												</SelectItem>
												<SelectItem value="block">
													{t('settings.health.fields.directBlock')}
												</SelectItem>
											</SelectContent>
										</Select>
									}
								/>

								<SettingsRow
									title={t('settings.health.fields.activeHoursStart')}
									actions={
										<Popover
											open={openPicker === 'start'}
											onOpenChange={(open) => setOpenPicker(open ? 'start' : null)}
										>
											<PopoverTrigger asChild>
												<Button
													id="health-active-start"
													type="button"
													variant="outline"
													data-empty={!settings.activeHours?.start}
													className="h-7 w-44 justify-start px-2 text-xs font-normal data-[empty=true]:text-muted-foreground"
													disabled={saving}
													aria-label={t('settings.health.fields.activeHoursStart')}
												>
													<CalendarIcon className="size-3 shrink-0 opacity-60" />
													<span className="truncate">
														{settings.activeHours?.start
															? format(parseISO(settings.activeHours.start), 'PP')
															: t('settings.health.fields.pickDate')}
													</span>
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
												<Calendar
													mode="single"
													captionLayout="dropdown"
													selected={
														settings.activeHours?.start
															? parseISO(settings.activeHours.start)
															: undefined
													}
													defaultMonth={
														settings.activeHours?.start
															? parseISO(settings.activeHours.start)
															: undefined
													}
													onSelect={(date) => {
														updateAndSave({
															activeHours: {
																start: date ? format(date, 'yyyy-MM-dd') : '',
																end: settings.activeHours?.end ?? '',
															},
														});
														setOpenPicker(null);
													}}
												/>
											</PopoverContent>
										</Popover>
									}
								/>

								<SettingsRow
									title={t('settings.health.fields.activeHoursEnd')}
									actions={
										<Popover
											open={openPicker === 'end'}
											onOpenChange={(open) => setOpenPicker(open ? 'end' : null)}
										>
											<PopoverTrigger asChild>
												<Button
													id="health-active-end"
													type="button"
													variant="outline"
													data-empty={!settings.activeHours?.end}
													className="h-7 w-44 justify-start px-2 text-xs font-normal data-[empty=true]:text-muted-foreground"
													disabled={saving}
													aria-label={t('settings.health.fields.activeHoursEnd')}
												>
													<CalendarIcon className="size-3 shrink-0 opacity-60" />
													<span className="truncate">
														{settings.activeHours?.end
															? format(parseISO(settings.activeHours.end), 'PP')
															: t('settings.health.fields.pickDate')}
													</span>
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
												<Calendar
													mode="single"
													captionLayout="dropdown"
													selected={
														settings.activeHours?.end
															? parseISO(settings.activeHours.end)
															: undefined
													}
													defaultMonth={
														settings.activeHours?.end
															? parseISO(settings.activeHours.end)
															: undefined
													}
													onSelect={(date) => {
														updateAndSave({
															activeHours: {
																start: settings.activeHours?.start ?? '',
																end: date ? format(date, 'yyyy-MM-dd') : '',
															},
														});
														setOpenPicker(null);
													}}
												/>
											</PopoverContent>
										</Popover>
									}
								/>
							</div>
							<ModelOptions
								key={`${settings.providerId}:${settings.modelId}`}
								inputs={inputs}
								values={settings.modelOptions ?? {}}
								inlineAdvanced
								onChange={updateModelOption}
							/>
						</ModelProviderConfiguration>
					</SettingsPanel>

					<SettingsSection title={t('settings.health.fields.cronScheduling')}>
						<SettingsPanel>
							<SettingsRow
								title={t('settings.health.fields.enabled')}
								actions={
									<Switch
										checked={settings.enabled}
										onCheckedChange={(enabled) => updateAndSave({ enabled })}
										disabled={saving}
										aria-label={t('settings.health.fields.enabled')}
									/>
								}
							/>
							<SettingsRow
								title={t('settings.health.fields.cronExpression')}
								actions={
									<Input
										value={cronDraft ?? settings.cronExpression}
										className="h-7 w-44 font-mono text-xs"
										aria-label={t('settings.health.fields.cronExpression')}
										disabled={saving}
										onChange={(event) => setCronDraft(event.target.value)}
										onBlur={() => {
											if (cronDraft !== undefined && cronDraft !== settings.cronExpression)
												updateAndSave({ cronExpression: cronDraft.trim().replace(/\s+/g, ' ') });
										}}
										onKeyDown={(event) => {
											if (event.key === 'Enter') event.currentTarget.blur();
										}}
									/>
								}
							/>
						</SettingsPanel>
					</SettingsSection>

					<SettingsPanel>
						<Link to="/settings/health/tools" className="block hover:bg-muted/40">
							<SettingsRow
								title={t('settings.modelServices.tools')}
								description={t('settings.modelServices.toolsDescription')}
								media={
									<Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
								}
								className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
								actionClassName="w-auto justify-end"
								actions={<ChevronRight className="size-4 text-muted-foreground" />}
							/>
						</Link>
					</SettingsPanel>

					{saved && (
						<SettingsAutoDismiss>
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.health.saved')}
							</p>
						</SettingsAutoDismiss>
					)}
				</>
			)}
		</SettingsPageShell>
	);
};

export default HealthPage;
