import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import type { KnowledgeState } from './state';

export default function Search({ knowledge }: { knowledge: KnowledgeState }): JSX.Element {
	const { t } = useTranslation();
	const {
		configuration,
		query,
		matches,
		disabled,
		searching,
		canSearch,
		currentIndex,
		indexModelMatches,
		setQuery,
		search,
		save,
	} = knowledge;
	const [minimumScore, setMinimumScore] = useState(String(configuration?.minimumScore ?? 0));
	useEffect(() => setMinimumScore(String(configuration?.minimumScore ?? 0)), [configuration]);
	return (
		<SettingsSection title={t('settings.knowledge.searchTitle')}>
			<SettingsPanel>
				<SettingsRow
					title={t('settings.knowledge.minimumScore')}
					description={t('settings.knowledge.minimumScoreDescription')}
					actions={
						<Input
							type="number"
							min={0}
							max={1}
							step={0.05}
							value={minimumScore}
							aria-label={t('settings.knowledge.minimumScore')}
							className="w-24 max-w-full text-xs"
							disabled={disabled}
							onChange={(event) => setMinimumScore(event.target.value)}
							onBlur={() => {
								if (
									minimumScore.trim() &&
									Number(minimumScore) !== (configuration?.minimumScore ?? 0)
								)
									void save({ minimumScore: Number(minimumScore) });
							}}
						/>
					}
				/>
				<form
					className="grid min-w-0 gap-3 p-4"
					onSubmit={(event) => {
						event.preventDefault();
						void search();
					}}
				>
					<Label htmlFor="knowledge-query" className="text-xs">
						{t('settings.knowledge.searchQuery')}
					</Label>
					<div className="flex min-w-0 flex-col gap-2 sm:flex-row">
						<Input
							id="knowledge-query"
							value={query}
							placeholder={t('settings.knowledge.searchPlaceholder')}
							disabled={disabled}
							onChange={(event) => setQuery(event.target.value)}
							className="min-w-0 flex-1 text-xs"
						/>
						<Button type="submit" size="sm" disabled={!canSearch} className="self-end">
							{searching ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								<SearchIcon className="size-3" />
							)}
							{t(searching ? 'settings.knowledge.searching' : 'settings.knowledge.search')}
						</Button>
					</div>
					{(!currentIndex || !indexModelMatches) && (
						<p className="text-[11px] leading-4 text-muted-foreground">
							{t('settings.knowledge.searchRequiresIndex')}
						</p>
					)}
					<div aria-live="polite" aria-busy={searching}>
						{matches?.length === 0 && (
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.knowledge.noResults')}
							</p>
						)}
						{Boolean(matches?.length) && (
							<ul className="grid min-w-0 gap-3">
								{matches?.map((match, index) => (
									<li
										key={`${match.path}:${index}`}
										className="grid min-w-0 gap-1 border-t border-border/60 pt-3"
									>
										<p className="truncate text-xs font-medium" title={match.path}>
											{match.path}
										</p>
										<p className="line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
											{match.text}
										</p>
									</li>
								))}
							</ul>
						)}
					</div>
				</form>
			</SettingsPanel>
		</SettingsSection>
	);
}
