import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
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
		<div className="flex w-full items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0">
			<Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div className="min-w-0 flex-1">
				<div className="truncate text-[13px] font-medium leading-4 text-foreground">
					Search Engine
				</div>
				<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
					{selectedEngine?.name ?? 'Select a search engine'}
				</p>
			</div>
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
				<SelectTrigger className="h-8 w-52 text-xs" aria-label="Search Engine">
					<SelectValue placeholder="Connect a search provider first" />
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
		</div>
	);
}
