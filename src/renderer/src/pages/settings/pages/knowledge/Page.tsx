import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { DataControls } from '../../components/data';
import Sources from './Sources';
import Embedding from './Embedding';
import Storage from './Storage';
import Indexing from './Indexing';
import Search from './Search';
import useKnowledge from './state';

export default function KnowledgePage(): JSX.Element {
	const { t } = useTranslation();
	const knowledge = useKnowledge();
	const { configuration, loading, error, disabled, save } = knowledge;
	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.knowledge.title')} description={t('settings.knowledge.description')} />
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					<div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
						<span>{error}</span>
						{!configuration && !loading && (
							<Button variant="outline" size="sm" onClick={() => void knowledge.load()}>
								<RefreshCw className="size-3" />
								{t('settings.knowledge.retry')}
							</Button>
						)}
					</div>
				</SettingsNotice>
			)}
			{loading ? (
				<SettingsPanel><SettingsLoadingRows rows={5} /></SettingsPanel>
			) : configuration ? (
				<>
					<SettingsPanel>
						<SettingsRow
							title={t('settings.knowledge.enabled')}
							description={t('settings.knowledge.enabledDescription')}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="ml-auto w-auto justify-end"
							actions={<Switch checked={configuration.enabled} disabled={disabled} aria-label={t('settings.knowledge.enabled')} onCheckedChange={(enabled) => void save({ enabled })} />}
						/>
					</SettingsPanel>
					<Sources knowledge={knowledge} />
					<Embedding knowledge={knowledge} />
					<Storage knowledge={knowledge} />
					<Indexing knowledge={knowledge} />
					<Search knowledge={knowledge} />
					<SettingsSection title={t('settings.dataControls.title')}>
						<fieldset disabled={disabled} className="min-w-0">
							<DataControls
								key={`${configuration.indexName}:${configuration.databaseProviderId}:${configuration.databaseId}`}
								kinds={knowledge.remoteDatabase ? ['local_index', 'local_namespace', 'remote_namespace', 'remote_all_namespaces'] : ['local_index', 'local_namespace']}
							/>
						</fieldset>
					</SettingsSection>
				</>
			) : null}
		</SettingsPageShell>
	);
}
