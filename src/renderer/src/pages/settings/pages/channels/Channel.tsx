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
import { Badge } from '@/components/ui/badge';
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
		credentials: {},
	}));
	const [listDrafts, setListDrafts] = useState<Record<ListField, string>>({
		allowFrom: '',
		groupAllowFrom: '',
	});
	const [saving, setSaving] = useState(false);
	const [configured, setConfigured] = useState(stored?.configured ?? false);
	const [error, setError] = useState<string | null>(null);

	const save = async (next: StoredChannelProvider): Promise<boolean> => {
		setCredential(next);
		setSaving(true);
		setError(null);
		try {
			const credentials = Object.fromEntries(
				Object.entries(next.credentials ?? {}).map(([key, value]) => [key, value.trim()])
			);
			const saved = await window.provider.setChannel({
				...next,
				credentials,
				apiKey: credentials.apiKey ?? next.apiKey,
			});
			await window.app.restartChannel(providerId);
			setCredential({ ...saved, apiKey: '', credentials: {} });
			setConfigured(saved.configured);
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
					<Badge variant="outline">
						{t(`settings.channels.${configured ? 'configured' : 'notConfigured'}`)}
					</Badge>
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
				{(service.credentials ?? []).map((field) => (
					<SettingsRow
						key={field.key}
						title={field.label}
						icon={KeyRound}
						actions={
							<>
								<Input
									id={`${providerId}-${field.key}`}
									type={field.type}
									autoComplete="off"
									value={credential.credentials?.[field.key] ?? ''}
									disabled={saving}
									onChange={(event) =>
										setCredential({
											...credential,
											credentials: { ...credential.credentials, [field.key]: event.target.value },
										})
									}
									className="h-8 min-w-0 flex-1 text-xs sm:w-64"
									aria-label={field.label}
									required={field.required}
								/>
							</>
						}
					/>
				))}
				{((service.credentials ?? []).length > 0 || !configured) && (
					<SettingsRow
						title={t('common.save')}
						actions={
							<Button
								type="button"
								size="sm"
								disabled={
									saving ||
									((service.credentials ?? []).length > 0 &&
										!Object.values(credential.credentials ?? {}).some((value) => value.trim()))
								}
								onClick={() => void save(credential)}
							>
								{t('common.save')}
							</Button>
						}
					/>
				)}
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
