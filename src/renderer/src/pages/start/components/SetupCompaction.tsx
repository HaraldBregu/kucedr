import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ModelProviderSelect, toModelProviderGroups } from '@/components/model-provider-select';
import type { AgentMediaModelSettings } from '@shared/agent_types';
import type { ProviderModelGroup } from '../setupTypes';

type SetupCompactionProps = {
	readonly modelGroups: ProviderModelGroup[];
	readonly disabled: boolean;
};

export function SetupCompaction({
	modelGroups,
	disabled,
}: SetupCompactionProps): React.JSX.Element {
	const [settings, setSettings] = useState<AgentMediaModelSettings>({
		providerId: '',
		modelId: '',
		options: {},
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		void window.agent
			.getCompactModel()
			.then((value) => {
				if (!cancelled) setSettings(value);
			})
			.catch(() => {
				if (!cancelled) setError('Could not load the compaction model.');
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const save = async (providerId: string, modelId: string): Promise<void> => {
		setSaving(true);
		setError('');
		try {
			setSettings(await window.agent.setCompactModel({ providerId, modelId, options: {} }));
		} catch {
			setError('Could not save the compaction model.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<Item
			data-testid="setup-compaction"
			variant="outline"
			size="md"
			className="flex-wrap gap-3 rounded-2xl border-b border-border/60 px-3 py-2 last:border-b-0 sm:flex-nowrap"
		>
			<ItemMedia variant="icon" className="size-10 rounded-2xl bg-muted/50">
				<Layers className="size-5" aria-hidden="true" />
			</ItemMedia>
			<ItemContent className="min-w-0 flex-col items-start gap-0.5">
				<ItemTitle className="text-sm leading-tight">Compaction model</ItemTitle>
				<p className="text-xs leading-tight text-muted-foreground">
					Used to summarize older messages when you compact a conversation. When disabled, the Chat
					LLM is used.
				</p>
				{error ? (
					<p className="text-xs text-destructive" role="alert">
						{error}
					</p>
				) : null}
			</ItemContent>
			<ItemActions className="ml-auto flex-none flex-col items-end gap-1">
				<ModelProviderSelect
					inline
					buttonDropdown
					buttonClassName="w-40 min-w-0"
					idPrefix="setup-compaction"
					providerGroups={toModelProviderGroups(modelGroups)}
					providerId={settings.providerId}
					modelId={settings.modelId}
					disabled={disabled || loading || saving}
					showFieldLabel={false}
					labels={{ label: 'Compaction model', placeholder: 'Disabled' }}
					onChange={(providerId, modelId) => void save(providerId, modelId)}
				/>
				{settings.providerId && settings.modelId ? (
					<Button
						type="button"
						variant="ghost"
						size="xs"
						disabled={disabled || loading || saving}
						onClick={() => void save('', '')}
					>
						Disable
					</Button>
				) : null}
			</ItemActions>
		</Item>
	);
}
