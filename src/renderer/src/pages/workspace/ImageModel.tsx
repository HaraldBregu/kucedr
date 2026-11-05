import { useEffect, useState } from 'react';
import { ModelProviderSelect } from '@/components/model-provider-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { providerIdsFor, providerModels } from '@/lib/providers';

export type ImageOptions = Readonly<Record<string, Readonly<Record<string, string>>>>;

export function ImageModel({ options = {}, onOptionsChange }: { readonly options?: ImageOptions; readonly onOptionsChange?: (options: ImageOptions) => void }): React.JSX.Element {
	const [selection, setSelection] = useState({ providerId: '', modelId: '' });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(false);
	const [groups, setGroups] = useState(() => providerIdsFor('text-to-image').map((id) => ({ id, models: providerModels(id, 'text-to-image') })));
	useEffect(() => {
		let active = true;
		const refresh = (): void => {
			setGroups(providerIdsFor('text-to-image').map((id) => ({ id, models: providerModels(id, 'text-to-image') })));
			void window.app.getWorkspaceImageModel().then((value) => { if (active) setSelection(value); }).catch(() => { if (active) setError(true); });
		};
		refresh();
		const unsubscribe = window.app.onModelsChanged(refresh);
		return () => { active = false; unsubscribe(); };
	}, []);
	const metadata = groups.find(({ id }) => id === selection.providerId)?.models.find(({ id }) => id === selection.modelId)?.metadata;
	const inputs = metadata?.documentationStatus === 'verified' ? metadata.inputs : {};
	const ratioName = inputs.aspect_ratio ? 'aspect_ratio' : 'size';
	const ratio = inputs[ratioName];
	const ratioChoices = ratio?.oneOf?.map((choice) => ({ value: String(choice.const), label: choice.title ?? String(choice.const) })) ?? ratio?.enum?.map((choice) => ({ value: String(choice), label: String(choice) })) ?? [];
	const modelKey = `${selection.providerId}:${selection.modelId}`;
	const ratioValue = options[modelKey]?.[ratioName] ?? String(ratio?.default ?? ratioChoices[0]?.value ?? '');
	return <div className="flex min-w-0 items-center gap-1">
		<ModelProviderSelect idPrefix="workspace-image" providerGroups={groups} providerId={selection.providerId} modelId={selection.modelId} onChange={(providerId, modelId) => {
			setSaving(true);
			setError(false);
			void window.app.setWorkspaceImageModel({ providerId, modelId }).then(() => setSelection({ providerId, modelId })).catch(() => setError(true)).finally(() => setSaving(false));
		}} disabled={saving || groups.length === 0} inline buttonDropdown compactPopover showFieldLabel={false} buttonClassName="h-9 min-w-0 max-w-48 rounded-full px-2 text-sm text-foreground shadow-none hover:text-foreground" labels={{ label: 'Change image model' }} />
		{onOptionsChange && ratioChoices.length > 0 ? <Select value={ratioValue} onValueChange={(value) => onOptionsChange({ ...options, [modelKey]: { [ratioName]: String(value) } })}>
			<SelectTrigger aria-label="Aspect ratio" className="h-9 w-auto rounded-full border-0 bg-transparent px-2 text-sm capitalize text-foreground shadow-none">
				<SelectValue>{ratioChoices.find((choice) => choice.value === ratioValue)?.label}</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{ratioChoices.map((choice) => <SelectItem key={choice.value} value={choice.value} className="capitalize">{choice.label}</SelectItem>)}
			</SelectContent>
		</Select> : null}
		{error ? <span role="alert" className="text-[11px] text-destructive">Model unavailable</span> : null}
	</div>;
}
