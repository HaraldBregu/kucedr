import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PluginScriptInfo } from '../../../../../../../shared/plugin_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
} from '../../../components';
import Configuration from './Configuration';

const ScriptDetailsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
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

	const back = (
		<Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/settings/scripts')}>
			<ArrowLeft className="size-4" />
			{t('settings.tabs.scripts')}
		</Button>
	);

	if (script === undefined) {
		return (
			<SettingsPageShell>
				{back}
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (!script) {
		return (
			<SettingsPageShell>
				{back}
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

	const details: { key: string; title: string; value?: string; mono?: boolean }[] = [
		{ key: 'name', title: t('settings.scripts.name'), value: script.name, mono: true },
		{ key: 'version', title: t('settings.integrations.plugin.version'), value: script.version },
		{ key: 'category', title: t('settings.scripts.category'), value: script.category },
		{ key: 'author', title: t('settings.integrations.plugin.author'), value: script.author },
		{ key: 'fence', title: t('settings.scripts.fence'), value: script.fence, mono: true },
	];

	return (
		<SettingsPageShell>
			{back}
			<header className="mb-6 flex items-start gap-4 py-2">
				<div className="min-w-0 flex-1">
					<h1 className="text-3xl font-normal leading-9 text-foreground">{script.title}</h1>
				</div>
			</header>
			<div className="flex flex-col gap-8 pb-8">
				<SettingsSection title={t('settings.scripts.information')}>
					<SettingsPanel>
						{details
							.filter((row) => row.value)
							.map((row) => (
								<SettingsRow key={row.key} title={row.title}>
									<SettingsValue mono={row.mono}>{row.value}</SettingsValue>
								</SettingsRow>
							))}
						<SettingsRow
							title={t('settings.scripts.plugin')}
							onClick={() =>
								navigate(`/settings/plugins/${encodeURIComponent(script.plugin.id)}`)
							}
						>
							<SettingsValue>{script.plugin.name}</SettingsValue>
						</SettingsRow>
					</SettingsPanel>
				</SettingsSection>
				{script.type === 'STORAGE' && <Configuration name={script.title} />}
			</div>
		</SettingsPageShell>
	);
};

export default ScriptDetailsPage;
