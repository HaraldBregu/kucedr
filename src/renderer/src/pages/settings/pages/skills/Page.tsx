import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	ChevronRight,
	FolderOpen,
	RefreshCw,
	Sparkles,
	Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SkillInfo } from '../../../../../../shared/skills_types';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';

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

			{successMessage && (
				<SettingsNotice autoDismiss>
					{successMessage}
				</SettingsNotice>
			)}

			<SettingsSection
				title={t('settings.skills.title')}
				description={skillsRoot || undefined}
			>
				<SettingsPanel>
					{loading ? (
						<SettingsLoadingRows rows={2} />
					) : skills.length === 0 ? (
						<SettingsEmptyState
							icon={Sparkles}
							title={t('settings.skills.empty')}
							description={t('settings.skills.emptyDescription')}
						/>
					) : (
						skills.map((skill) => (
							<Item
								key={skill.id}
								role="button"
								tabIndex={0}
								variant="outline"
								size="md"
								className="cursor-pointer border-b border-border/60 hover:bg-muted/40 last:border-b-0 px-5 py-4"
								onClick={() => navigate(`/settings/agent/skills/skilldetails/${encodeURIComponent(skill.id)}`)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										navigate(`/settings/agent/skills/skilldetails/${encodeURIComponent(skill.id)}`);
									}
								}}
							>
								<ItemContent className="min-w-0 flex-1 flex-col items-start gap-1">
									<ItemTitle className="max-w-full truncate">
										{skill.manifest.name}
									</ItemTitle>
									<p className="line-clamp-2 max-w-full text-[11px] leading-4 text-muted-foreground">
										{skill.manifest.description || t('settings.skills.noDescription')}
									</p>
								</ItemContent>
								<ItemActions className="ml-auto flex-none justify-end">
									<ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" strokeWidth={1.8} />
								</ItemActions>
							</Item>
						))
					)}
				</SettingsPanel>
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default SkillsPage;
