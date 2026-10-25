import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsNotice, SettingsPageHeader, SettingsPageShell } from '../../components';
import Available from './Available';
import Installed from './Installed';

const PluginsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const [successMessage, setSuccessMessage] = useState('');
	const [version, setVersion] = useState(0);
	const [searchParams, setSearchParams] = useSearchParams();

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.integrations.title')}
				description={t('settings.integrations.description')}
			/>
			{successMessage && <SettingsNotice autoDismiss>{successMessage}</SettingsNotice>}
			<Tabs
				value={searchParams.get('tab') === 'marketplace' ? 'marketplace' : 'installed'}
				onValueChange={(tab) => setSearchParams({ tab: String(tab) }, { replace: true })}
			>
				<TabsList>
					<TabsTrigger value="installed">{t('settings.integrations.installed.title')}</TabsTrigger>
					<TabsTrigger value="marketplace">
						{t('settings.integrations.available.title')}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="installed">
					<Installed key={version} />
				</TabsContent>
				<TabsContent value="marketplace">
					<Available
						key={version}
						onInstalled={(name) => {
							setSuccessMessage(t('settings.integrations.uploaded', { name }));
							setVersion((current) => current + 1);
						}}
					/>
				</TabsContent>
			</Tabs>
		</SettingsPageShell>
	);
};

export default PluginsPage;
