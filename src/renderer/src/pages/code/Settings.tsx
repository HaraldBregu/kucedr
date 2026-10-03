import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	CODER_HARNESSES,
	CODING_THINKING_LEVELS,
	type CoderHarness,
	type CodingSettings,
} from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const harnessLabels = { pi: 'Pi', codex: 'Codex', cline: 'Cline' };
const providerLabels = { 'openai-codex': 'OpenAI Codex', openai: 'OpenAI', anthropic: 'Anthropic', cline: 'Cline' };

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
		]).then(([selected, ...values]) => {
			if (cancelled) return;
			setRuntime(selected.runtime);
			setProfiles(Object.fromEntries(values.map((value) => [value.runtime, value])));
		}).catch((reason: unknown) => {
			if (!cancelled) setError(reason instanceof Error ? reason.message : t('codeSettings.loadError', 'Could not load Coder settings.'));
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
			mounted.current = false;
		};
	}, [t]);

	const settings = profiles[runtime];
	const providers = runtime === 'pi' ? ['openai-codex', 'openai', 'anthropic'] : runtime === 'codex' ? ['openai-codex'] : ['cline'];
	const fields = settings ? [
		{ key: 'runtime', label: t('codeSettings.harness', 'Default harness'), value: runtime, options: CODER_HARNESSES.map((value) => ({ value, label: harnessLabels[value] })) },
		{ key: 'providerId', label: t('codeSettings.provider', 'Provider'), value: settings.providerId, options: providers.map((value) => ({ value, label: providerLabels[value as keyof typeof providerLabels] })) },
		{ key: 'thinkingLevel', label: t('codeSettings.thinking', 'Thinking level'), value: settings.thinkingLevel, options: CODING_THINKING_LEVELS.map((value) => ({ value, label: t(`codeSettings.thinkingLevels.${value}`, value) })) },
		{ key: 'toolMode', label: t('codeSettings.tools', 'Tool access'), value: settings.toolMode, options: [{ value: 'read-only', label: t('codeSettings.readOnly', 'Read only') }, { value: 'coding', label: t('codeSettings.coding', 'Read and edit files') }] },
	] : [];

	return (
		<section aria-labelledby="coder-settings-title" className="h-full overflow-y-auto p-6">
			<div className="mx-auto w-full max-w-2xl">
				<form className="grid gap-4" onSubmit={(event) => {
					event.preventDefault();
					if (!settings || saving) return;
					setSaving(true);
					setError('');
					void window.coder.saveSettings(settings).then(() => {
						if (mounted.current) onClose();
					}).catch((reason: unknown) => {
						if (mounted.current) setError(reason instanceof Error ? reason.message : t('codeSettings.saveError', 'Could not save Coder settings.'));
					}).finally(() => {
						if (mounted.current) setSaving(false);
					});
				}}>
					<header className="grid gap-2 pb-2">
						<h1 id="coder-settings-title" className="text-xl font-semibold">{t('codeSettings.title', 'Coder settings')}</h1>
						<p className="text-sm text-muted-foreground">{t('codeSettings.description', 'Defaults for new sessions in every workspace. Existing sessions keep their saved settings.')}</p>
					</header>
					{loading ? <p role="status" className="text-sm text-muted-foreground">{t('codeSettings.loading', 'Loading settings…')}</p> : null}
					{fields.map((field) => (
						<div key={field.key} className="grid gap-2">
							<Label htmlFor={`coder-${field.key}`}>{field.label}</Label>
							<Select value={field.value} disabled={saving} onValueChange={(value) => {
								if (!value || !settings) return;
								if (field.key === 'runtime') setRuntime(value as CoderHarness);
								else setProfiles((previous) => ({ ...previous, [runtime]: { ...settings, [field.key]: value, ...(field.key === 'providerId' ? { modelId: '' } : {}) } }));
							}}>
								<SelectTrigger id={`coder-${field.key}`} className="w-full"><SelectValue>{field.options.find((option) => option.value === field.value)?.label}</SelectValue></SelectTrigger>
								<SelectContent>{field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
							</Select>
						</div>
					))}
					{settings ? <div className="grid gap-2">
						<Label htmlFor="coder-model">{t('codeSettings.model', 'Model')}</Label>
						<Input id="coder-model" value={settings.modelId} disabled={saving} placeholder={t('codeSettings.modelPlaceholder', 'Enter a model ID')} onChange={(event) => setProfiles((previous) => ({ ...previous, [runtime]: { ...settings, modelId: event.target.value } }))} />
					</div> : null}
					{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
					<footer className="flex justify-end gap-2 border-t pt-4">
						<Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
						<Button type="submit" disabled={loading || saving || !settings}>{saving ? t('codeSettings.saving', 'Saving…') : t('codeSettings.save', 'Save defaults')}</Button>
					</footer>
				</form>
			</div>
		</section>
	);
}
