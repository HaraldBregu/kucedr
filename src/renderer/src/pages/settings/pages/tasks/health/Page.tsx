import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Calendar as CalendarIcon, LoaderCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { providerIdsFor, providerModels, providers } from '@/lib/providers';
import type { ProviderModelGroup } from '@pages/start/setupTypes';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
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

const EVERY_OPTIONS: readonly HealthSettings['every'][] = ['0m', '1m', '30m', '1h'];

const HealthPage: React.FC = () => {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<HealthSettings | null>(null);
	const [checklist, setChecklist] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

	useEffect(() => {
		let mounted = true;
		void Promise.all([window.agent.healthGetSettings(), window.agent.healthGetData()])
			.then(([result, data]) => {
				if (!mounted) return;
				setSettings(result);
				setChecklist(data);
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

	const update = (patch: Partial<HealthSettings>): void => {
		setSettings((current) => (current ? { ...current, ...patch } : current));
		setSaved(false);
	};

	const updateAndSave = (patch: Partial<HealthSettings>): void => {
		if (!settings) return;
		const next = { ...settings, ...patch };
		setSettings(next);
		const activeHours =
			next.activeHours?.start && next.activeHours?.end ? next.activeHours : undefined;
		window.agent.healthSaveSettings({ ...next, activeHours }).catch((err: unknown) => {
			setError(err instanceof Error ? err.message : t('settings.health.errors.saveFailed'));
		});
	};

	const handleSave = async (): Promise<void> => {
		if (!settings) return;
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			const activeHours =
				settings.activeHours?.start && settings.activeHours?.end
					? settings.activeHours
					: undefined;
			await window.agent.healthSaveSettings({ ...settings, activeHours });
			await window.agent.healthSaveData(checklist);
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : t('settings.health.errors.saveFailed'));
		} finally {
			setSaving(false);
		}
	};

	const modelGroups = llmModelGroups();

	const targetOptions =
		settings && settings.target !== 'none' && settings.target !== 'last'
			? (['none', 'last', settings.target] as const)
			: (['none', 'last'] as const);

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
					<SettingsSection
						title={t('settings.health.settingsTitle')}
						description={t('settings.health.settingsDescription')}
					>
						<div className="grid gap-3">
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
								description={t('settings.modelServices.modelDescription')}
								onChange={(providerId, modelId) => updateAndSave({ providerId, modelId })}
							/>
							<SettingsPanel>
								<Item
									variant="outline"
									size="md"
									className="border-b border-border/60 last:border-b-0 px-5 py-4"
								>
									<ItemContent className="min-w-0 flex-1">
										<ItemTitle className="max-w-full truncate">
											{t('settings.health.fields.every')}
										</ItemTitle>
									</ItemContent>
									<ItemActions className="ml-auto flex-none justify-end">
										<Select
											value={settings.every}
											onValueChange={(value) =>
												update({ every: (value ?? '0m') as HealthSettings['every'] })
											}
											disabled={saving}
										>
											<SelectTrigger id="health-every" className="h-7 w-44 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{EVERY_OPTIONS.map((option) => (
													<SelectItem key={option} value={option}>
														{option === '0m' ? t('settings.health.fields.everyOff') : option}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</ItemActions>
								</Item>

								<Item
									variant="outline"
									size="md"
									className="border-b border-border/60 last:border-b-0 px-5 py-4"
								>
									<ItemContent className="min-w-0 flex-1">
										<ItemTitle className="max-w-full truncate">
											{t('settings.health.fields.target')}
										</ItemTitle>
									</ItemContent>
									<ItemActions className="ml-auto flex-none justify-end">
										<Select
											value={settings.target}
											onValueChange={(value) => update({ target: value ?? 'none' })}
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
									</ItemActions>
								</Item>

								<Item
									variant="outline"
									size="md"
									className="border-b border-border/60 last:border-b-0 px-5 py-4"
								>
									<ItemContent className="min-w-0 flex-1">
										<ItemTitle className="max-w-full truncate">
											{t('settings.health.fields.directPolicy')}
										</ItemTitle>
									</ItemContent>
									<ItemActions className="ml-auto flex-none justify-end">
										<Select
											value={settings.directPolicy}
											onValueChange={(value) =>
												update({
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
									</ItemActions>
								</Item>

								<Item
									variant="outline"
									size="md"
									className="border-b border-border/60 last:border-b-0 px-5 py-4"
								>
									<ItemContent className="min-w-0 flex-1">
										<ItemTitle className="max-w-full truncate">
											{t('settings.health.fields.activeHoursStart')}
										</ItemTitle>
									</ItemContent>
									<ItemActions className="ml-auto flex-none justify-end">
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
														update({
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
									</ItemActions>
								</Item>

								<Item
									variant="outline"
									size="md"
									className="border-b border-border/60 last:border-b-0 px-5 py-4"
								>
									<ItemContent className="min-w-0 flex-1">
										<ItemTitle className="max-w-full truncate">
											{t('settings.health.fields.activeHoursEnd')}
										</ItemTitle>
									</ItemContent>
									<ItemActions className="ml-auto flex-none justify-end">
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
														update({
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
									</ItemActions>
								</Item>

							</SettingsPanel>
						</div>
					</SettingsSection>

					<SettingsSection
						title={t('settings.health.checklistTitle')}
						description={t('settings.health.checklistDescription')}
					>
						<Textarea
							value={checklist}
							onChange={(event) => {
								setChecklist(event.target.value);
								setSaved(false);
							}}
							rows={10}
							spellCheck={false}
							className="font-mono text-xs"
							disabled={saving}
							aria-label={t('settings.health.checklistTitle')}
						/>
					</SettingsSection>

					{saved && (
						<p className="text-[11px] leading-4 text-muted-foreground">
							{t('settings.health.saved')}
						</p>
					)}

					<div className="flex justify-end">
						<Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
							{saving ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								<Save className="size-3" />
							)}
							{saving ? t('settings.health.saving') : t('common.save')}
						</Button>
					</div>
				</>
			)}
		</SettingsPageShell>
	);
};

export default HealthPage;
