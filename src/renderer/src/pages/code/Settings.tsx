import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bot, Brain, Cpu, Loader2, Plug, Shield } from 'lucide-react';
import {
	CODER_HARNESSES,
	CODING_THINKING_LEVELS,
	type CoderHarness,
	type CodingSettings,
} from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../settings/components';

const harnessLabels = { pi: 'Pi', codex: 'Codex', cline: 'Cline' };
const providerLabels = {
	'openai-codex': 'OpenAI Codex',
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	cline: 'Cline',
};

export function CodeSettings({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
	const { t } = useTranslation();
	const [runtime, setRuntime] = useState<CoderHarness>('pi');
	const [profiles, setProfiles] = useState<Partial<Record<CoderHarness, CodingSettings>>>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const mounted = useRef(false);

	useEffect(() => {
		mounted.current = true;
		let cancelled = false;
		void Promise.all([
			window.coder.getSettings(),
			...CODER_HARNESSES.map((harness) => window.coder.getSettings(harness)),
		])
			.then(([selected, ...values]) => {
				if (cancelled) return;
				setRuntime(selected.runtime);
				setProfiles(Object.fromEntries(values.map((value) => [value.runtime, value])));
			})
			.catch((reason: unknown) => {
				if (!cancelled)
					setError(
						reason instanceof Error
							? reason.message
							: t('codeSettings.loadError', 'Could not load Coder settings.')
					);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
			mounted.current = false;
		};
	}, [t]);

	const settings = profiles[runtime];
	const providers =
		runtime === 'pi'
			? ['openai-codex', 'openai', 'anthropic']
			: runtime === 'codex'
				? ['openai-codex']
				: ['cline'];
	const fields = settings
		? [
				{
					key: 'runtime',
					group: 'model',
					icon: Bot,
					description: t(
						'codeSettings.harnessDescription',
						'The coding agent used for new sessions.'
					),
					label: t('codeSettings.harness', 'Default harness'),
					value: runtime,
					options: CODER_HARNESSES.map((value) => ({ value, label: harnessLabels[value] })),
				},
				{
					key: 'providerId',
					group: 'model',
					icon: Plug,
					description: t(
						'codeSettings.providerDescription',
						'The service that provides your model.'
					),
					label: t('codeSettings.provider', 'Provider'),
					value: settings.providerId,
					options: providers.map((value) => ({
						value,
						label: providerLabels[value as keyof typeof providerLabels],
					})),
				},
				{
					key: 'modelId',
					group: 'model',
					icon: Cpu,
					description: t(
						'codeSettings.modelDescription',
						'Use a model ID supported by your provider.'
					),
					label: t('codeSettings.model', 'Model'),
					value: settings.modelId,
					options: null,
				},
				{
					key: 'thinkingLevel',
					group: 'behavior',
					icon: Brain,
					description: t('codeSettings.thinkingDescription', 'How much reasoning the agent uses.'),
					label: t('codeSettings.thinking', 'Thinking level'),
					value: settings.thinkingLevel,
					options: CODING_THINKING_LEVELS.map((value) => ({
						value,
						label: t(`codeSettings.thinkingLevels.${value}`, value),
					})),
				},
				{
					key: 'toolMode',
					group: 'behavior',
					icon: Shield,
					description: t(
						'codeSettings.toolsDescription',
						'Choose whether the agent can edit files.'
					),
					label: t('codeSettings.tools', 'Tool access'),
					value: settings.toolMode,
					options: [
						{ value: 'read-only', label: t('codeSettings.readOnly', 'Read only') },
						{ value: 'coding', label: t('codeSettings.coding', 'Read and edit files') },
					],
				},
			]
		: [];

	return (
		<section aria-labelledby="coder-settings-title" className="h-full overflow-y-auto">
			<SettingsPageShell>
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!settings || saving) return;
						setSaving(true);
						setError('');
						void window.coder
							.saveSettings(settings)
							.then(() => {
								if (mounted.current) onClose();
							})
							.catch((reason: unknown) => {
								if (mounted.current)
									setError(
										reason instanceof Error
											? reason.message
											: t('codeSettings.saveError', 'Could not save Coder settings.')
									);
							})
							.finally(() => {
								if (mounted.current) setSaving(false);
							});
					}}
				>
					<SettingsPageHeader
						title={
							<span id="coder-settings-title">{t('codeSettings.title', 'Coder settings')}</span>
						}
						description={t(
							'codeSettings.description',
							'Defaults for new sessions in every workspace. Existing sessions keep their saved settings.'
						)}
					/>
					{loading ? (
						<div role="status" aria-label={t('codeSettings.loading', 'Loading settings…')}>
							<SettingsPanel>
								<SettingsLoadingRows rows={5} />
							</SettingsPanel>
						</div>
					) : settings ? (
						[
							{ key: 'model', title: t('codeSettings.agentModel', 'Agent and model') },
							{ key: 'behavior', title: t('codeSettings.behavior', 'Session behavior') },
						].map((group) => (
							<SettingsSection key={group.key} title={group.title}>
								<SettingsPanel>
									{fields
										.filter((field) => field.group === group.key)
										.map((field) => (
											<SettingsRow
												key={field.key}
												icon={field.icon}
												title={
													<Label
														htmlFor={field.key === 'modelId' ? 'coder-model' : `coder-${field.key}`}
														className="text-[13px]"
													>
														{field.label}
													</Label>
												}
												description={
													<span id={`coder-${field.key}-description`}>{field.description}</span>
												}
												actionClassName="sm:w-52"
											>
												{field.options ? (
													<Select
														value={field.value}
														disabled={saving}
														onValueChange={(value) => {
															if (!value) return;
															if (field.key === 'runtime') setRuntime(value as CoderHarness);
															else
																setProfiles((previous) => ({
																	...previous,
																	[runtime]: {
																		...settings,
																		[field.key]: value,
																		...(field.key === 'providerId' ? { modelId: '' } : {}),
																	},
																}));
														}}
													>
														<SelectTrigger
															id={`coder-${field.key}`}
															aria-describedby={`coder-${field.key}-description`}
															className="w-full"
														>
															<SelectValue>
																{
																	field.options.find((option) => option.value === field.value)
																		?.label
																}
															</SelectValue>
														</SelectTrigger>
														<SelectContent>
															{field.options.map((option) => (
																<SelectItem key={option.value} value={option.value}>
																	{option.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												) : (
													<Input
														id="coder-model"
														aria-describedby="coder-modelId-description"
														value={settings.modelId}
														disabled={saving}
														placeholder={t('codeSettings.modelPlaceholder', 'Enter a model ID')}
														onChange={(event) =>
															setProfiles((previous) => ({
																...previous,
																[runtime]: { ...settings, modelId: event.target.value },
															}))
														}
													/>
												)}
											</SettingsRow>
										))}
								</SettingsPanel>
							</SettingsSection>
						))
					) : null}
					{error ? (
						<SettingsNotice variant="destructive" icon={AlertCircle}>
							{error}
						</SettingsNotice>
					) : null}
					<footer className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
						<Button type="button" variant="outline" disabled={saving} onClick={onClose}>
							{t('common.cancel', 'Cancel')}
						</Button>
						<Button type="submit" disabled={loading || saving || !settings}>
							{saving && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
							{saving
								? t('codeSettings.saving', 'Saving…')
								: t('codeSettings.save', 'Save defaults')}
						</Button>
					</footer>
				</form>
			</SettingsPageShell>
		</section>
	);
}
