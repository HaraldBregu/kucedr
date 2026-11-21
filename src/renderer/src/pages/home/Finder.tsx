import { useEffect, useId, useState, type ReactElement } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AgentSessionSearchResult } from '@shared/agent_types';
import { formatChatAge } from './formatChatAge';

export function ChatFinder({ query, onQueryChange, onOpen }: {
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly onOpen: (result: AgentSessionSearchResult) => void;
}): ReactElement {
	const { t } = useTranslation();
	const id = useId();
	const [results, setResults] = useState<AgentSessionSearchResult[]>();
	const [active, setActive] = useState(0);
	const needle = query.trim();
	useEffect(() => {
		if (!needle) return;
		let stale = false;
		const timer = window.setTimeout(() => {
			void window.agent
				.searchSessions(needle)
				.catch((): AgentSessionSearchResult[] => [])
				.then((found) => {
					if (stale) return;
					setResults(found);
					setActive(0);
				});
		}, 200);
		return () => {
			stale = true;
			window.clearTimeout(timer);
		};
	}, [needle]);
	useEffect(() => {
		document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
	}, [id, active]);
	const change = (value: string): void => {
		onQueryChange(value);
		if (!value.trim()) setResults(undefined);
	};
	return (
		<>
			<div className="shrink-0 px-2 pt-2">
				<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				<Input
					type="search"
					role="combobox"
					aria-expanded={!!needle}
					aria-controls={id}
					aria-autocomplete="list"
					aria-activedescendant={needle && results?.[active] ? `${id}-${active}` : undefined}
					value={query}
					placeholder={t('settings.chatHistory.search')}
					aria-label={t('settings.chatHistory.search')}
					className="h-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
					onChange={(event) => change(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Escape' && query) {
							event.preventDefault();
							change('');
						}
						if (!needle || !results?.length) return;
						if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault();
							setActive((active + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
						}
						if (event.key === 'Enter') {
							event.preventDefault();
							onOpen(results[active]);
						}
					}}
				/>
				</div>
			</div>
			{needle && (
				<section className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pt-3">
					<p className="px-2 pb-2 text-xs text-muted-foreground" role="status">
						{!results
							? t('settings.chatHistory.loading')
							: results.length
								? t('settings.chatHistory.searchResults', { count: results.length })
								: t('settings.chatHistory.searchEmpty')}
					</p>
					<ul id={id} role="listbox" aria-label={t('settings.chatHistory.search')} className="flex min-w-0 flex-col gap-1">
						{results?.map((result, index) => (
							<li
								key={result.id}
								id={`${id}-${index}`}
								role="option"
								aria-selected={index === active}
								className={cn(
									'cursor-default rounded-md px-2.5 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
									index === active && 'bg-sidebar-accent text-sidebar-accent-foreground'
								)}
								onClick={() => {
									setActive(index);
									onOpen(result);
								}}
							>
								<div className="flex min-w-0 items-center gap-2 text-sm">
									<span className="min-w-0 flex-1 truncate">{result.title.trim() || t('settings.chatHistory.untitled')}</span>
									{result.archived && <Badge variant="outline">{t('settings.chatHistory.searchArchived')}</Badge>}
									<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatChatAge(result.lastMessageAtMs)}</span>
								</div>
								{result.snippets.map((snippet, row) => {
									const at = snippet.toLowerCase().indexOf(needle.toLowerCase());
									return (
										<p key={row} className="line-clamp-2 text-xs text-muted-foreground">
											{at < 0 ? snippet : <>{snippet.slice(0, at)}<mark className="bg-transparent font-semibold text-foreground">{snippet.slice(at, at + needle.length)}</mark>{snippet.slice(at + needle.length)}</>}
										</p>
									);
								})}
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	);
}
