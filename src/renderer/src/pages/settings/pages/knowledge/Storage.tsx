import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Database } from 'lucide-react';
import { LOCAL_RAG_DATABASE_PROVIDER_ID } from '@shared/rag_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import { LOCAL_DATABASE_VALUE, VALUE_SEPARATOR, type KnowledgeState } from './state';

export default function Storage({ knowledge }: { knowledge: KnowledgeState }): JSX.Element {
	const { t } = useTranslation();
	const {
		configuration,
		databases,
		disabled,
		localDatabase,
		remoteDatabase,
		selectedDatabase,
		mirrorConsentMatches,
		save,
	} = knowledge;
	const [indexName, setIndexName] = useState(configuration?.indexName ?? '');
	useEffect(() => setIndexName(configuration?.indexName ?? ''), [configuration]);
	return (
		<SettingsSection
			title={t('settings.knowledge.storageTitle')}
			action={
				<Button variant="outline" size="sm" disabled={disabled} nativeButton={false} render={<Link to="/settings/providers/database" />}>
					{t('settings.knowledge.configureDatabases')}
				</Button>
			}
		>
			<SettingsPanel>
				<SettingsRow
					title={t('settings.knowledge.databaseTitle')}
					description={t('settings.knowledge.databaseDescription')}
					icon={Database}
					actions={
						<Select
							value={
								localDatabase
									? LOCAL_DATABASE_VALUE
									: selectedDatabase
										? `${selectedDatabase.providerId}${VALUE_SEPARATOR}${selectedDatabase.databaseId}`
										: null
							}
							disabled={disabled}
							onValueChange={(value) => {
								if (!value) return;
								const [databaseProviderId, databaseId] = value.split(VALUE_SEPARATOR);
								void save({ databaseProviderId, databaseId, mirrorConsent: null });
							}}
						>
							<SelectTrigger
								aria-label={t('settings.knowledge.databaseTitle')}
								size="sm"
								className="w-64 max-w-full text-xs"
							>
								<SelectValue placeholder={t('settings.knowledge.databasePlaceholder')}>
									{localDatabase
										? t('settings.knowledge.localDatabase')
										: selectedDatabase
											? `${selectedDatabase.providerName} / ${selectedDatabase.databaseName}`
											: null}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={LOCAL_DATABASE_VALUE}>
									{t('settings.knowledge.localDatabase')}
								</SelectItem>
								{databases
									.filter((database) => database.providerId !== LOCAL_RAG_DATABASE_PROVIDER_ID)
									.map((database) => (
										<SelectItem
											key={`${database.providerId}${VALUE_SEPARATOR}${database.databaseId}`}
											value={`${database.providerId}${VALUE_SEPARATOR}${database.databaseId}`}
										>{`${database.providerName} / ${database.databaseName}`}</SelectItem>
									))}
							</SelectContent>
						</Select>
					}
				/>
				<SettingsRow
					title={t('settings.knowledge.indexName')}
					description={t('settings.knowledge.indexNameDescription')}
					actions={
						<Input
							value={indexName}
							aria-label={t('settings.knowledge.indexName')}
							placeholder={t('settings.knowledge.indexNamePlaceholder')}
							className="w-64 max-w-full text-xs"
							maxLength={45}
							disabled={disabled}
							onChange={(event) => setIndexName(event.target.value)}
							onBlur={() => {
								if (indexName !== configuration?.indexName) void save({ indexName });
							}}
						/>
					}
				/>
				{remoteDatabase && (
					<SettingsRow
						title={t('settings.knowledge.mirrorConsent')}
						description={t('settings.knowledge.mirrorConsentDescription', {
							index: configuration?.indexName,
						})}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="ml-auto w-auto justify-end"
						actions={
							<Switch
								checked={mirrorConsentMatches}
								disabled={disabled}
								aria-label={t('settings.knowledge.mirrorConsent')}
								onCheckedChange={(enabled) =>
									void save({
										mirrorConsent:
											enabled && configuration
												? { version: 1, indexName: configuration.indexName }
												: null,
									})
								}
							/>
						}
					/>
				)}
			</SettingsPanel>
		</SettingsSection>
	);
}
