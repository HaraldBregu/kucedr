import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import type { KnowledgeState } from './state';

export default function Sources({ knowledge }: { knowledge: KnowledgeState }): JSX.Element {
	const { t } = useTranslation();
	const { configuration, status, disabled, save, pickFolder } = knowledge;
	return (
		<SettingsSection
			title={t('settings.knowledge.sourceFolder')}
			description={t('settings.knowledge.documentsDescription')}
			action={
				<Button variant="outline" size="sm" disabled={disabled} onClick={() => void pickFolder()}>
					<Plus className="size-3" />
					{t('settings.knowledge.pickFolder')}
				</Button>
			}
		>
			<SettingsPanel>
				{configuration?.folders.length ? (
					configuration.folders.map((folder) => {
						const source = status?.sources?.find((entry) => entry.folder === folder);
						return (
						<SettingsRow
							key={folder}
							icon={FolderOpen}
							title={
								<span className="block truncate" title={folder}>
									{folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder}
								</span>
							}
							description={
								<span className="grid min-w-0 gap-0.5">
									<span className="block truncate" title={folder}>{folder}</span>
									{source && <span className="text-xs">
										{t('settings.knowledge.sourceStats', {
											files: source.files,
											chunks: source.chunks,
											date: source.indexedAt
												? new Date(source.indexedAt).toLocaleString()
												: t('settings.knowledge.notIndexed'),
										})}
									</span>}
									{source?.error && <span className="text-xs text-destructive">{source.error}</span>}
								</span>
							}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="ml-auto w-auto justify-end"
							actions={
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={disabled}
									aria-label={t('settings.knowledge.removeFolderPath', { folder })}
									onClick={() =>
										void save({
											folders: configuration.folders.filter((entry) => entry !== folder),
										})
									}
								>
									<Trash2 className="size-3" />
								</Button>
							}
						/>
						);
					})
				) : (
					<SettingsRow title={t('settings.knowledge.sourcePlaceholder')} icon={FolderOpen} />
				)}
			</SettingsPanel>
		</SettingsSection>
	);
}
