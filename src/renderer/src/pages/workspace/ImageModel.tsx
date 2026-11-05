import { useEffect, useState } from 'react';
import { ModelProviderSelect } from '@/components/model-provider-select';
import { providerIdsFor, providerModels } from '@/lib/providers';

export function ImageModel({ onSelectionChange }: { readonly onSelectionChange?: (selection: { providerId: string; modelId: string }) => void }): React.JSX.Element {
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
	useEffect(() => { onSelectionChange?.(selection); }, [onSelectionChange, selection]);
	return <div className="flex min-w-0 items-center gap-1">
		<ModelProviderSelect idPrefix="workspace-image" providerGroups={groups} providerId={selection.providerId} modelId={selection.modelId} onChange={(providerId, modelId) => {
			setSaving(true);
			setError(false);
			void window.app.setWorkspaceImageModel({ providerId, modelId }).then(() => setSelection({ providerId, modelId })).catch(() => setError(true)).finally(() => setSaving(false));
		}} disabled={saving || groups.length === 0} inline buttonDropdown compactPopover showFieldLabel={false} buttonClassName="h-9 min-w-0 max-w-48 rounded-full px-2 text-sm text-foreground shadow-none hover:text-foreground" labels={{ label: 'Change image model' }} />
		{error ? <span role="alert" className="text-[11px] text-destructive">Model unavailable</span> : null}
	</div>;
}
