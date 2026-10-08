import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { SEARCH_ENGINES } from '@pages/settings/pages/search/catalog';
import type { SearchEngineId, SearchSettings } from '@shared/search_types';

export function SetupSearch(): React.JSX.Element {
	const [settings, setSettings] = useState<SearchSettings | null>(null);

	useEffect(() => {
		let cancelled = false;
		void window.search
			.getSettings()
			.then((value) => {
				if (!cancelled) setSettings(value);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	const selectedEngineId =
		settings?.engineId && settings.configured[settings.engineId] ? settings.engineId : null;
	const selectedEngine = SEARCH_ENGINES.find((engine) => engine.id === selectedEngineId);

	return (
		<Item
			variant="ghost"
			size="md"
			className="flex-nowrap gap-3 rounded-2xl border-b border-border/60 px-3 py-2 last:border-b-0"
		>
			<ItemMedia variant="icon" className="size-10 rounded-2xl bg-muted/50">
				<Search className="size-5" aria-hidden="true" />
			</ItemMedia>
			<ItemContent className="min-w-0 flex-col items-start gap-0.5">
				<ItemTitle className="min-w-0 max-w-full truncate text-sm leading-tight">
					Search Engine
				</ItemTitle>
				<p className="max-w-full truncate text-xs leading-tight text-muted-foreground">
					{selectedEngine?.name ?? 'Select a search engine'}
				</p>
			</ItemContent>
			<ItemActions className="ml-auto flex-none justify-end">
				<Select
					value={selectedEngineId}
					disabled={!settings}
					onValueChange={(value) => {
						if (!value) return;
						void window.search
							.selectEngine(value as SearchEngineId)
							.then(setSettings)
							.catch(() => undefined);
					}}
				>
					<SelectTrigger className="h-8 w-40 text-xs" aria-label="Search Engine">
						<SelectValue placeholder="Connect a search provider first">
							{(value) =>
								SEARCH_ENGINES.find((engine) => engine.id === value)?.name ??
								'Connect a search provider first'
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{SEARCH_ENGINES.map((engine) => (
							<SelectItem
								key={engine.id}
								value={engine.id}
								disabled={!settings?.configured[engine.id]}
							>
								{engine.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</ItemActions>
		</Item>
	);
}
