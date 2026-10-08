import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Hash, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import { CHANNEL_DM_POLICIES } from '@shared/channels_types';
import type {
	ChannelCredentialSummary,
	ChannelDmPolicy,
	StoredChannelProvider,
} from '@shared/channels_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { openExternalUrl } from '@/lib/external-links';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import { ListEditor } from './List';

type ListField = 'allowFrom' | 'groupAllowFrom';

export function ChannelConfiguration({
	service,
	stored,
}: {
	readonly service: CatalogService;
	readonly stored?: ChannelCredentialSummary;
}): React.JSX.Element {
	const { t } = useTranslation();
	const providerId = service.provider.id;
	const [credential, setCredential] = useState<StoredChannelProvider>(() => ({
		id: providerId,
		name: service.provider.name,
		baseUrl: service.url ?? service.provider.baseUrl,
		allowFrom: [],
		groupAllowFrom: [],
		dmPolicy: 'allowlist',
		...stored,
		apiKey: '',
	}));
	const [listDrafts, setListDrafts] = useState<Record<ListField, string>>({
		allowFrom: '',
		groupAllowFrom: '',
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const apiKeyCredential = service.credentials?.find(({ key }) => key === 'apiKey');

	const save = async (next: StoredChannelProvider): Promise<boolean> => {
		setCredential(next);
		setSaving(true);
		setError(null);
		try {
			const saved = await window.provider.setChannel(next);
			setCredential({ ...saved, apiKey: '' });
			return true;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			return false;
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsSection
			title={
				<span className="flex items-center gap-2">
					<ProviderAvatar
						providerId={providerId}
						name={service.provider.name}
						iconDarkUrl={service.provider.iconDarkUrl}
						iconLightUrl={service.provider.iconLightUrl}
						className="size-5 rounded-md"
					/>
					{service.provider.name}
				</span>
			}
			description={service.instructions ?? service.description ?? service.name}
			action={
				service.provider.apiKeyUrl ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => void openExternalUrl(service.provider.apiKeyUrl!)}
					>
						<ExternalLink className="size-3.5" />
						{t('settings.channels.getToken')}
					</Button>
				) : undefined
			}
		>
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
			<SettingsPanel>
				<SettingsRow
					title={apiKeyCredential?.label ?? t('settings.channels.token')}
					description={t('settings.channels.tokenDescription')}
					icon={KeyRound}
					actions={
						<>
							<Input
								id={`${providerId}-${apiKeyCredential?.key ?? 'apiKey'}`}
								type={apiKeyCredential?.type ?? 'password'}
								autoComplete="off"
								value={credential.apiKey}
								disabled={saving}
								onChange={(event) => setCredential({ ...credential, apiKey: event.target.value })}
								placeholder={t('settings.channels.tokenPlaceholder')}
								className="h-8 min-w-0 flex-1 text-xs sm:w-64"
								aria-label={apiKeyCredential?.label ?? t('settings.channels.token')}
								required={apiKeyCredential?.required}
							/>
							<Button
								type="button"
								size="sm"
								disabled={saving || !credential.apiKey.trim()}
								onClick={() => void save({ ...credential, apiKey: credential.apiKey.trim() })}
							>
								{t('common.save')}
							</Button>
						</>
					}
				/>
				<SettingsRow
					title={t('settings.channels.dmPolicy')}
					description={t('settings.channels.dmPolicyDescription')}
					icon={ShieldCheck}
					actions={
						<Select
							value={credential.dmPolicy ?? 'allowlist'}
							disabled={saving}
							onValueChange={(value) => {
								if (value)
									void save({
										...credential,
										dmPolicy: value as ChannelDmPolicy,
									});
							}}
						>
							<SelectTrigger
								className="w-full sm:w-64"
								aria-label={t('settings.channels.dmPolicy')}
							>
								<SelectValue>
									{t(`settings.channels.dmPolicies.${credential.dmPolicy ?? 'allowlist'}`)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{CHANNEL_DM_POLICIES.map((policy) => (
									<SelectItem key={policy} value={policy}>
										{t(`settings.channels.dmPolicies.${policy}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
				{(['allowFrom', 'groupAllowFrom'] as const).map((field) => (
					<SettingsRow
						key={field}
						title={t(`settings.channels.${field}`)}
						description={t(`settings.channels.${field}Description`)}
						icon={field === 'allowFrom' ? UserRound : Hash}
						className="grid-cols-1! gap-3"
						actionClassName="w-full!"
						actions={
							<ListEditor
								id={`${providerId}-${field}`}
								value={listDrafts[field]}
								items={credential[field] ?? []}
								disabled={saving}
								placeholder={t(`settings.channels.${field}Placeholder`)}
								addLabel={t(
									`settings.channels.${field === 'allowFrom' ? 'addAllowFrom' : 'addGroupAllowFrom'}`
								)}
								removeLabel={(value) =>
									t(
										`settings.channels.${field === 'allowFrom' ? 'removeAllowFrom' : 'removeGroupAllowFrom'}`,
										{ value }
									)
								}
								emptyLabel={t(
									`settings.channels.${field === 'allowFrom' ? 'noAllowFrom' : 'noGroupAllowFrom'}`
								)}
								onDraftChange={(value) =>
									setListDrafts((current) => ({ ...current, [field]: value }))
								}
								onAdd={() => {
									const value = listDrafts[field].trim();
									if (!value) return;
									void save({
										...credential,
										[field]: [...new Set([...(credential[field] ?? []), value])],
									}).then((saved) => {
										if (saved) setListDrafts((current) => ({ ...current, [field]: '' }));
									});
								}}
								onRemove={(value) =>
									void save({
										...credential,
										[field]: (credential[field] ?? []).filter((entry) => entry !== value),
									})
								}
							/>
						}
					/>
				))}
			</SettingsPanel>
		</SettingsSection>
	);
}
