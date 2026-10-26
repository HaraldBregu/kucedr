import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plug } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AvailablePlugin } from '@shared/plugin_types';
import { Button } from '@/components/ui/button';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageShell,
	SettingsPanel,
} from '../../components';
import Meta from './Meta';
import PluginIcon from './PluginIcon';

export default function MarketplacePage(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { pluginId } = useParams<{ pluginId: string }>();
	const [plugin, setPlugin] = useState<AvailablePlugin | null | undefined>(undefined);
	const [installing, setInstalling] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		window.plugins
			.available()
			.then((plugins) => {
				const found = plugins.find((item) => item.id === pluginId);
				// Already installed and up to date: its own page shows it.
				if (!found) navigate(`/settings/plugins/${pluginId}`, { replace: true });
				else setPlugin(found);
			})
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : String(caught));
				setPlugin(null);
			});
	}, [navigate, pluginId]);

	const install = async (id: string): Promise<void> => {
		setInstalling(true);
		setError('');
		try {
			await window.plugins.installCatalog(id);
			navigate(`/settings/plugins/${id}`, { replace: true });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			setInstalling(false);
		}
	};

	const back = (
		<Button
			variant="ghost"
			size="sm"
			className="w-fit"
			onClick={() => navigate('/settings/plugins?tab=marketplace')}
		>
			<ArrowLeft className="size-4" />
			{t('settings.integrations.title')}
		</Button>
	);

	if (plugin === undefined) {
		return (
			<SettingsPageShell>
				{back}
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			</SettingsPageShell>
		);
	}

	if (plugin === null) {
		return (
			<SettingsPageShell>
				{back}
				{error ? (
					<SettingsNotice variant="destructive">{error}</SettingsNotice>
				) : (
					<SettingsEmptyState
						icon={Plug}
						title={t('settings.integrations.plugin.notFound')}
						description={t('settings.integrations.plugin.notFoundDescription')}
					/>
				)}
			</SettingsPageShell>
		);
	}

	const kinds: Record<string, string> = {
		apps: t('settings.integrations.plugin.apps'),
		mcp: t('settings.integrations.plugin.mcp'),
		providers: t('settings.integrations.plugin.providers'),
		skills: t('settings.integrations.plugin.skills'),
	};
	const details = [
		{ key: 'id', title: t('settings.integrations.plugin.id'), value: plugin.id },
		{ key: 'version', title: t('settings.integrations.plugin.version'), value: plugin.version },
		{ key: 'author', title: t('settings.integrations.plugin.author'), value: plugin.author },
		{
			key: 'minAppVersion',
			title: t('settings.integrations.plugin.minAppVersion'),
			value: plugin.minAppVersion,
		},
		{
			key: 'categories',
			title: t('settings.integrations.plugin.categories'),
			value: plugin.categories.join(', '),
		},
		{
			key: 'contains',
			title: t('settings.integrations.plugin.contains'),
			value: plugin.contains.map((kind) => kinds[kind]).join(', '),
		},
	].filter((row) => row.value);

	return (
		<SettingsPageShell>
			{back}
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<header className="mb-6 flex items-start gap-4 py-2">
				<PluginIcon plugin={plugin} className="size-14" />
				<div className="min-w-0 flex-1">
					<h1 className="text-3xl font-normal leading-9 text-foreground">{plugin.title}</h1>
					<p className="mt-1.5 max-w-2xl text-base leading-5 text-muted-foreground">
						{plugin.description}
					</p>
					<Meta rows={details} />
				</div>
				<Button
					type="button"
					size="sm"
					className="shrink-0"
					disabled={installing}
					onClick={() => void install(plugin.id)}
				>
					{installing
						? t('settings.integrations.installed.installing')
						: plugin.update
							? t('settings.integrations.marketplace.update')
							: t('settings.integrations.installed.install')}
				</Button>
			</header>
		</SettingsPageShell>
	);
}
