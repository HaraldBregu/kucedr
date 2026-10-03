import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CODER_HARNESSES, CODING_THINKING_LEVELS, type CoderHarness, type CodingProject, type CodingSettings } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel, SettingsRow, SettingsSection } from '../settings/components';

const harnessLabels = { pi: 'Pi', codex: 'Codex', cline: 'Cline' };
const providerLabels = { 'openai-codex': 'OpenAI Codex', openai: 'OpenAI', anthropic: 'Anthropic', cline: 'Cline' };

export function NewWorkspace({ onCreated, onCancel }: { readonly onCreated: (project: CodingProject) => void; readonly onCancel: () => void }): React.JSX.Element {
	const { t } = useTranslation();
	const [name, setName] = useState('');
	const [shared, setShared] = useState(true);
	const [runtime, setRuntime] = useState<CoderHarness>('pi');
	const [profiles, setProfiles] = useState<Partial<Record<CoderHarness, CodingSettings>>>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [loadError, setLoadError] = useState('');
	const [error, setError] = useState('');
	const [attempt, setAttempt] = useState(0);
	const mounted = useRef(false);
	const submitting = useRef(false);

	useEffect(() => {
		mounted.current = true;
		let cancelled = false;
		setLoading(true);
		setLoadError('');
		void Promise.all([window.coder.getSettings(), ...CODER_HARNESSES.map((harness) => window.coder.getSettings(harness))])
			.then(([selected, ...values]) => {
				if (cancelled) return;
				setRuntime(selected.runtime);
				setProfiles(Object.fromEntries(values.map((value) => [value.runtime, value])));
			}).catch((cause: unknown) => {
				if (!cancelled) setLoadError(cause instanceof Error ? cause.message : t('codeWorkspace.loadError', 'Unable to load workspace settings.'));
			}).finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; mounted.current = false; };
	}, [attempt, t]);

	const settings = profiles[runtime];
	const providers = runtime === 'pi' ? ['openai-codex', 'openai', 'anthropic'] : runtime === 'codex' ? ['openai-codex'] : ['cline'];
	const fields = settings ? [
		{ key: 'runtime', label: t('codeWorkspace.harness', 'Harness'), value: runtime, options: CODER_HARNESSES.map((value) => ({ value, label: harnessLabels[value] })) },
		{ key: 'providerId', label: t('codeSettings.provider', 'Provider'), value: settings.providerId, options: providers.map((value) => ({ value, label: providerLabels[value as keyof typeof providerLabels] })) },
		{ key: 'thinkingLevel', label: t('codeSettings.thinking', 'Thinking level'), value: settings.thinkingLevel, options: CODING_THINKING_LEVELS.map((value) => ({ value, label: t(`codeSettings.thinkingLevels.${value}`, value) })) },
		{ key: 'toolMode', label: t('codeSettings.tools', 'Tool access'), value: settings.toolMode, options: [{ value: 'read-only', label: t('codeSettings.readOnly', 'Read only') }, { value: 'coding', label: t('codeSettings.coding', 'Read and edit files') }] },
	] : [];

	return (
		<section aria-labelledby="new-workspace-title" className="h-full overflow-y-auto">
			<SettingsPageShell>
				<form noValidate className="grid gap-4" onSubmit={(event) => {
					event.preventDefault();
					if (submitting.current) return;
					const trimmedName = name.trim();
					if (!trimmedName || trimmedName.length > 120) { setError(t('codeWorkspace.nameError', 'Enter a workspace name between 1 and 120 characters.')); return; }
					if (!shared && (loading || !settings || loadError)) return;
					submitting.current = true;
					setSaving(true);
					setError('');
					void window.coder.addProject({ name: trimmedName, ...(!shared ? { settings } : {}) }).then((project) => {
						if (!mounted.current) return;
						if (project) onCreated(project);
						else setError(t('codeWorkspace.createError', 'Unable to create workspace.'));
					}).catch((cause: unknown) => {
						if (mounted.current) setError(cause instanceof Error ? cause.message : t('codeWorkspace.createError', 'Unable to create workspace.'));
					}).finally(() => { submitting.current = false; if (mounted.current) setSaving(false); });
				}}>
					<SettingsPageHeader title={<span id="new-workspace-title">{t('codeWorkspace.title', 'New workspace')}</span>} description={t('codeWorkspace.description', 'Create a workspace with its own files, sessions, and configuration.')} />
					<SettingsPanel>
						<SettingsRow title={<Label htmlFor="new-workspace-name">{t('codeWorkspace.name', 'Workspace name')}</Label>} actionClassName="sm:w-64">
							<Input id="new-workspace-name" autoFocus required maxLength={120} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} />
						</SettingsRow>
						<SettingsRow title={<Label htmlFor="new-workspace-shared">{t('codeWorkspace.shared', 'Use shared Coder settings')}</Label>} description={t('codeWorkspace.sharedDescription', 'Follow the shared defaults for new sessions in this workspace.')}>
							<Switch id="new-workspace-shared" checked={shared} disabled={saving} onCheckedChange={setShared} />
						</SettingsRow>
					</SettingsPanel>
					{!shared ? <SettingsSection title={t('codeWorkspace.configuration', 'Workspace configuration')}>
						{loading ? <p role="status" className="text-sm text-muted-foreground">{t('codeSettings.loading', 'Loading settings…')}</p> : loadError ? <div className="flex items-center gap-3"><p role="alert" className="text-sm text-destructive">{loadError}</p><Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>{t('codeWorkspace.retry', 'Retry')}</Button></div> : settings ? <SettingsPanel>
							{fields.map((field) => <SettingsRow key={field.key} title={<Label htmlFor={`new-workspace-${field.key}`}>{field.label}</Label>} actionClassName="sm:w-64">
								<Select value={field.value} disabled={saving} onValueChange={(value) => {
									if (!value) return;
									if (field.key === 'runtime') setRuntime(value as CoderHarness);
									else setProfiles((previous) => ({ ...previous, [runtime]: { ...settings, [field.key]: value, ...(field.key === 'providerId' ? { modelId: '' } : {}) } }));
								}}>
									<SelectTrigger id={`new-workspace-${field.key}`} className="w-full"><SelectValue>{field.options.find((option) => option.value === field.value)?.label}</SelectValue></SelectTrigger>
									<SelectContent>{field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
								</Select>
							</SettingsRow>)}
							<SettingsRow title={<Label htmlFor="new-workspace-model">{t('codeSettings.model', 'Model')}</Label>} actionClassName="sm:w-64"><Input id="new-workspace-model" value={settings.modelId} disabled={saving} placeholder={t('codeSettings.modelPlaceholder', 'Enter a model ID')} onChange={(event) => setProfiles((previous) => ({ ...previous, [runtime]: { ...settings, modelId: event.target.value } }))} /></SettingsRow>
						</SettingsPanel> : null}
					</SettingsSection> : null}
					{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
					<footer className="flex justify-end gap-2 border-t border-border/60 pt-4">
						<Button type="button" variant="outline" disabled={saving} onClick={onCancel}>{t('common.cancel', 'Cancel')}</Button>
						<Button type="submit" disabled={saving || (!shared && (loading || !settings || Boolean(loadError)))}>{saving ? t('codeWorkspace.creating', 'Creating…') : t('codeWorkspace.create', 'Create workspace')}</Button>
					</footer>
				</form>
			</SettingsPageShell>
		</section>
	);
}
