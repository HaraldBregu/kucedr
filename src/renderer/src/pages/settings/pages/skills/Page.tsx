import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	ChevronRight,
	FolderOpen,
	Plug,
	RefreshCw,
	Sparkles,
	Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
	const [skillsRoot, setSkillsRoot] = useState('');
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('all');
	const categoryOf = (skill: SkillInfo): string => skill.plugin?.name ?? 'local';
	const categories = [...new Set(skills.map(categoryOf))].sort();
	const visibleSkills = skills.filter(
		(skill) =>
			(category === 'all' || categoryOf(skill) === category) &&
			`${skill.manifest.name} ${skill.manifest.description}`
				.toLowerCase()
				.includes(query.trim().toLowerCase())
	);
	const open = (skill: SkillInfo): void => {
		void navigate(`/settings/skills/skilldetails/${encodeURIComponent(skill.id)}`);
	};

	const loadSkills = useCallback(async (): Promise<void> => {
		setLoading(true);
		setErrorMessage('');
		try {
			const [list, root] = await Promise.all([window.skills.list(), window.skills.getRoot()]);
			setSkills(list);
			setSkillsRoot(root);
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.skills.loadError')));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadSkills();
	}, [loadSkills]);

	const handleOpenFolder = useCallback(async (): Promise<void> => {
		setErrorMessage('');
		try {
			await window.skills.openRoot();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.skills.openFolderError')));
		}
	}, [t]);

	const handleImport = useCallback(async (): Promise<void> => {
		setImporting(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await window.skills.import();
			if (result) {
				const importedCount = result.imported.length;
				const skippedCount = result.skipped.length;
				setSuccessMessage(
					t('settings.skills.uploaded', {
						count: String(importedCount),
						skipped: String(skippedCount),
					})
				);
				await loadSkills();
			}
		} catch (error) {
			setErrorMessage(getErrorMessage(error, t('settings.skills.uploadError')));
		} finally {
			setImporting(false);
		}
	}, [loadSkills, t]);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.skills')}
				description={t('settings.skills.description')}
				action={
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="xs"
							onClick={() => void handleOpenFolder()}
							disabled={loading || importing}
						>
							<FolderOpen className="size-3" />
							{t('settings.skills.openFolder')}
						</Button>
						<Button
							variant="outline"
							size="xs"
							onClick={loadSkills}
							disabled={loading || importing}
						>
							<RefreshCw className="size-3" />
							{t('settings.skills.refresh')}
						</Button>
						<Button size="xs" onClick={() => void handleImport()} disabled={loading || importing}>
							<Upload className="size-3" />
							{importing ? t('settings.skills.uploading') : t('settings.skills.upload')}
						</Button>
					</div>
				}
			/>

			{errorMessage && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{errorMessage}
				</SettingsNotice>
			)}

			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}

			{!loading && skills.length === 0 && (
				<SettingsEmptyState
					icon={Sparkles}
					title={t('settings.skills.empty')}
					description={t('settings.skills.emptyDescription')}
				/>
			)}

			{(loading || skills.length > 0) && (
				<section className="pb-4" aria-labelledby="installed-skills-title">
					<h2 id="installed-skills-title" className="text-sm font-medium">
						{t('settings.skills.title')}
					</h2>
					{skillsRoot && (
						<p className="mt-0.5 truncate text-xs text-muted-foreground">{skillsRoot}</p>
					)}
					<div className="mt-2">
						<SettingsFilter
							query={query}
							onQueryChange={setQuery}
							categories={categories}
							category={category}
							onCategoryChange={setCategory}
						/>
					</div>
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
