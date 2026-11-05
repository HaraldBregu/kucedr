import { useEffect, useState } from 'react';
import { ModelProviderSelect } from '@/components/model-provider-select';
import { providerIdsFor, providerModels } from '@/lib/providers';

const KINDS = {
	image: { capability: 'text-to-image', label: 'Change image model', get: () => window.app.getWorkspaceImageModel(), set: (model: { providerId: string; modelId: string }) => window.app.setWorkspaceImageModel(model) },
	voice: { capability: 'text-to-speech', label: 'Change voice model', get: () => window.app.getWorkspaceVoiceModel(), set: (model: { providerId: string; modelId: string }) => window.app.setWorkspaceVoiceModel(model) },
} as const;

export function MediaModel({ kind, onSelectionChange }: { readonly kind: keyof typeof KINDS; readonly onSelectionChange?: (selection: { providerId: string; modelId: string }) => void }): React.JSX.Element {
	const { capability, label, get, set } = KINDS[kind];
	const [selection, setSelection] = useState({ providerId: '', modelId: '' });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(false);
	const [groups, setGroups] = useState(() => providerIdsFor(capability).map((id) => ({ id, models: providerModels(id, capability) })));
	useEffect(() => {
		let active = true;
		const refresh = (): void => {
			setGroups(providerIdsFor(capability).map((id) => ({ id, models: providerModels(id, capability) })));
			void get().then((value) => { if (active) setSelection(value); }).catch(() => { if (active) setError(true); });
		};
		refresh();
		const unsubscribe = window.app.onModelsChanged(refresh);
		return () => { active = false; unsubscribe(); };
	}, [capability, get]);
	useEffect(() => { onSelectionChange?.(selection); }, [onSelectionChange, selection]);
	return <div className="flex min-w-0 items-center gap-1">
		<ModelProviderSelect idPrefix={`workspace-${kind}`} providerGroups={groups} providerId={selection.providerId} modelId={selection.modelId} onChange={(providerId, modelId) => {
			setSaving(true);
			setError(false);
			void set({ providerId, modelId }).then(() => setSelection({ providerId, modelId })).catch(() => setError(true)).finally(() => setSaving(false));
		}} disabled={saving || groups.length === 0} inline buttonDropdown compactPopover showFieldLabel={false} buttonClassName="h-9 min-w-0 max-w-48 rounded-full px-2 text-sm text-foreground shadow-none hover:text-foreground" labels={{ label }} />
		{error ? <span role="alert" className="text-[11px] text-destructive">Model unavailable</span> : null}
	</div>;
}
