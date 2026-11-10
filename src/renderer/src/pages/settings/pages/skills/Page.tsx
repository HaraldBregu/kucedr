import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	ChevronRight,
	Folder,
	Plug,
	Sparkles,
	Tag,
	User,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillInfo } from '../../../../../../shared/skills_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import { SettingsFilter } from '../../components/filter';

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return fallback;
}

const SkillsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [skills, setSkills] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState('');
	const filter = useSettingsFilter(skills, {
		text: (skill) =>
			`${skill.manifest.name} ${skill.manifest.description} ${skill.manifest.metadata?.category ?? ''} ${skill.manifest.metadata?.author ?? ''} ${skill.plugin?.name ?? ''}`,
		category: (skill) => skill.plugin?.name ?? 'local',
	});
	const open = (skill: SkillInfo): void => {
		void navigate(`/settings/skills/skilldetails/${encodeURIComponent(skill.id)}`);
	};

	const loadSkills = useCallback(async (): Promise<void> => {
		setLoading(true);
		setErrorMessage('');
		try {
			const list = await window.skills.list();
			setSkills(list);
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.skills.loadError')));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadSkills();
	}, [loadSkills]);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.skills')}
				description={t('settings.skills.description')}
			/>

			<SettingsFilter
				query={query}
				onQueryChange={setQuery}
				categories={categories}
				category={category}
				onCategoryChange={setCategory}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			{!loading && skills.length === 0 && (
				<SettingsEmptyState
					icon={Sparkles}
					title={t('settings.skills.empty')}
					description={t('settings.skills.emptyDescription')}
				/>
			)}

			{(loading || skills.length > 0) && (
				<section className="pb-4">
					{loading ? (
						<SettingsPanel>
							<SettingsLoadingRows rows={2} />
						</SettingsPanel>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{visibleSkills.map((skill) => (
								<Card
									key={skill.id}
									size="sm"
									role="link"
									tabIndex={0}
									className="cursor-pointer transition-colors hover:bg-muted hover:ring-foreground/20 focus-visible:bg-muted focus-visible:ring-foreground/20"
									onClick={() => open(skill)}
									onKeyDown={(event) => {
										if (
											event.target === event.currentTarget &&
											(event.key === 'Enter' || event.key === ' ')
										) {
											event.preventDefault();
											open(skill);
										}
									}}
								>
									<CardHeader className="flex flex-1 items-center gap-3">
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<CardTitle className="truncate">{skill.manifest.name}</CardTitle>
											<p className="line-clamp-2 text-xs text-muted-foreground">
												{skill.manifest.description || t('settings.skills.noDescription')}
											</p>
											<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
												{skill.manifest.metadata?.category && (
													<span className="flex items-center gap-1">
														<Folder className="size-3" aria-hidden="true" />
														{skill.manifest.metadata.category}
													</span>
												)}
												{skill.manifest.metadata?.version && (
													<span className="flex items-center gap-1">
														<Tag className="size-3" aria-hidden="true" />
														<span className="sr-only">{t('settings.skills.detailVersion')}</span>
														{skill.manifest.metadata.version}
													</span>
												)}
												{skill.manifest.metadata?.author && (
													<span className="flex items-center gap-1">
														<User className="size-3" aria-hidden="true" />
														<span className="sr-only">{t('settings.skills.detailAuthor')}</span>
														{skill.manifest.metadata.author}
													</span>
												)}
												<span className="flex items-center gap-1">
													<Plug className="size-3" aria-hidden="true" />
													{skill.plugin?.name ?? t('settings.filter.categories.local')}
												</span>
											</div>
										</div>
										<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
									</CardHeader>
								</Card>
							))}
						</div>
					)}
				</section>
			)}
		</SettingsPageShell>
	);
};

export default SkillsPage;
