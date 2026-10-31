import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Code, FileCode, Folder, Plug, Tag, User } from 'lucide-react';
import type { PluginScriptInfo } from '../../../../../../../shared/plugin_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
} from '../../../components';
import Meta from '../../plugins/Meta';
import Configuration from './Configuration';

const ScriptDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const { scriptName } = useParams<{ scriptName: string }>();
	const name = decodeURIComponent(scriptName ?? '');
	const [script, setScript] = useState<PluginScriptInfo | null | undefined>(undefined);
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		window.plugins.scripts().then(
			(list) => setScript(list.find((item) => item.name === name) ?? null),
			() => {
				setErrorMessage(t('settings.scripts.loadError'));
				setScript(null);
			}
		);
	}, [name, t]);

	if (script === undefined) {
		return (
			<SettingsPageShell>
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!script) {
		return (
			<SettingsPageShell>
				{errorMessage && (
					<SettingsNotice variant="destructive" icon={AlertTriangle}>
						{errorMessage}
					</SettingsNotice>
				)}
				<SettingsEmptyState
					icon={FileCode}
					title={name || t('settings.scripts.empty')}
					description={t('settings.scripts.emptyDescription')}
				/>
			</SettingsPageShell>
		);
	}

	const details = [
		{ key: 'version', title: t('settings.integrations.plugin.version'), icon: Tag, value: script.version },
		{ key: 'category', title: t('settings.scripts.category'), icon: Folder, value: script.category },
		{ key: 'author', title: t('settings.integrations.plugin.author'), icon: User, value: script.author },
		{ key: 'fence', title: t('settings.scripts.fence'), icon: Code, value: script.fence },
		{ key: 'plugin', title: t('settings.scripts.plugin'), icon: Plug, value: script.plugin.name },
	].filter((row) => row.value);

	return (
		<SettingsPageShell>
			<header className="mb-6 flex items-start gap-4 py-2">
				<div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
					<FileCode className="size-1/2" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="text-3xl font-normal leading-9 text-foreground">{script.title}</h1>
					<p className="mt-1.5 max-w-2xl text-base leading-5 text-muted-foreground">
						{script.description}
					</p>
					<Meta rows={details} />
				</div>
			</header>
			<div className="flex flex-col gap-8 pb-8">
				{script.type === 'STORAGE' && <Configuration name={script.title} />}
			</div>
		</SettingsPageShell>
	);
};

export default ScriptDetailsPage;
