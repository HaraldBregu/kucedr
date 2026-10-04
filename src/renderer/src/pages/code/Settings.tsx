import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bot, Brain, Cpu, FolderOpen, Loader2, Plug, Shield } from 'lucide-react';
import {
	CODER_HARNESSES,
	CODING_THINKING_LEVELS,
	type CoderHarness,
	type CodingSettings,
	type CodingProject,
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

export function CodeSettings({ onClose, project, onSaved }: { readonly onClose: () => void; readonly project?: CodingProject; readonly onSaved?: () => void }): React.JSX.Element {
	const { t } = useTranslation();
	const [name, setName] = useState(project?.name ?? '');
	const [directory, setDirectory] = useState(project?.settings?.workingDirectory ?? project?.directory ?? '');
	const [picking, setPicking] = useState(false);
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
				setRuntime(project?.settings?.runtime ?? selected.runtime);
				setProfiles({ ...Object.fromEntries(values.map((value) => [value.runtime, value])), ...(project?.settings ? { [project.settings.runtime]: project.settings } : {}) });
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
	}, [project, t]);

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
					label: project ? t('codeWorkspace.harness', 'Harness') : t('codeSettings.harness', 'Default harness'),
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
						if (!settings || saving || picking) return;
						if (project && !name.trim()) { setError(t('codeWorkspace.nameError', 'Enter a workspace name between 1 and 120 characters.')); return; }
						setSaving(true);
						setError('');
						void (project ? window.coder.updateProject(project.id, { name: name.trim(), settings: { ...settings, workingDirectory: directory.trim() || undefined } }) : window.coder.saveSettings(settings))
							.then(() => {
								if (mounted.current) { onSaved?.(); onClose(); }
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
							<span id="coder-settings-title">{project ? t('codeWorkspace.settings', 'Workspace settings') : t('codeSettings.title', 'Coder settings')}</span>
						}
						description={project ? t('codeWorkspace.settingsDescription', 'Configure this workspace. New sessions use these settings; existing sessions keep their saved configuration.') : t(
							'codeSettings.description',
							'Defaults for new sessions in every workspace. Existing sessions keep their saved settings.'
						)}
					/>
					{project && <SettingsSection title={t('codeWorkspace.workspace', 'Workspace')}>
						<SettingsPanel>
							<SettingsRow title={<Label htmlFor="coder-workspace-name">{t('codeWorkspace.name', 'Workspace name')}</Label>} actionClassName="sm:w-72">
								<Input id="coder-workspace-name" required maxLength={120} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} />
							</SettingsRow>
							<SettingsRow icon={FolderOpen} title={<Label htmlFor="coder-working-directory">{t('codeWorkspace.directory', 'Working directory')}</Label>} description={t('codeWorkspace.directoryDescription', 'The folder where the harness reads files and runs commands. Leave empty to use the workspace files folder.')} actionClassName="sm:w-72">
								<div className="flex w-full min-w-0 gap-2">
									<Input className="min-w-0 flex-1" id="coder-working-directory" value={directory} disabled={saving || picking} placeholder={project.directory} onChange={(event) => setDirectory(event.target.value)} />
									<Button type="button" variant="outline" size="icon" className="shrink-0" disabled={saving || picking} aria-label={t('codeWorkspace.browse', 'Choose working directory')} onClick={() => {
										setPicking(true);
										void window.coder.pickDirectory().then((value) => { if (mounted.current && value) setDirectory(value); }).catch((cause: unknown) => { if (mounted.current) setError(cause instanceof Error ? cause.message : t('codeWorkspace.directoryError', 'Unable to choose directory.')); }).finally(() => { if (mounted.current) setPicking(false); });
									}}><FolderOpen /></Button>
								</div>
							</SettingsRow>
						</SettingsPanel>
					</SettingsSection>}
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
						<Button type="submit" disabled={loading || saving || picking || !settings}>
							{saving && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
							{saving
								? t('codeSettings.saving', 'Saving…')
								: project ? t('codeWorkspace.save', 'Save workspace') : t('codeSettings.save', 'Save defaults')}
						</Button>
					</footer>
				</form>
			</SettingsPageShell>
		</section>
	);
}
