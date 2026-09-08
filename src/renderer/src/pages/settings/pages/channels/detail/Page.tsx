import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, KeyRound, Plus, ShieldCheck, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { SettingsNotice, SettingsPageHeader, SettingsPageShell } from '../../../components';
import type { CatalogService } from '@shared/provider_types';
import { CHANNEL_DM_POLICIES } from '@shared/channels_types';
import type { ChannelDmPolicy, StoredChannelProvider } from '@shared/channels_types';

type ListField = 'allowFrom' | 'groupAllowFrom';

const SETTINGS_INPUT_CLASS = 'h-8 w-full text-xs sm:w-80';

const ChannelDetailPage: React.FC = () => {
	const { t } = useTranslation();
	const providerId = 'telegram';
	const [service, setService] = useState<CatalogService | null>(null);
	const [credential, setCredential] = useState<StoredChannelProvider | null>(null);
	const [listDrafts, setListDrafts] = useState<Record<ListField, string>>({
		allowFrom: '',
		groupAllowFrom: '',
	});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;

		void Promise.all([window.app.channels(), window.provider.getChannel(providerId)])
			.then(([services, stored]) => {
				if (!mounted) return;
				const entry = services.find((item) => item.provider.id === providerId) ?? null;
				setService(entry);
				setCredential(stored ? { ...stored, apiKey: '' } : blankCredential(providerId, entry));
			})
			.catch((err) => {
				console.error('[ChannelDetailPage] Failed to load channel:', err);
				if (mounted) setError(err instanceof Error ? err.message : String(err));
			});

		return () => {
			mounted = false;
		};
	}, [providerId]);

	const save = async (next: StoredChannelProvider): Promise<void> => {
		setCredential(next);
		setError(null);
		try {
			const saved = await window.provider.setChannel(next);
			setCredential({ ...saved, apiKey: '' });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const addListValue = (field: ListField): void => {
		const value = listDrafts[field].trim();
		if (!value || !credential) return;
		setListDrafts((current) => ({ ...current, [field]: '' }));
		void save({
			...credential,
			[field]: [...new Set([...(credential[field] ?? []), value])],
		});
	};

	const removeListValue = (field: ListField, value: string): void => {
		if (!credential) return;
		void save({
			...credential,
			[field]: (credential[field] ?? []).filter((item) => item !== value),
		});
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={service?.provider.name ?? t('settings.channels.configuration')}
				description={service?.name}
			/>

			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}

			{credential ? (
				<Card size="sm" className="gap-0! p-0!">
					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<KeyRound className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent className="min-w-0 flex-col items-start gap-0.5">
							<ItemTitle>{t('settings.channels.token')}</ItemTitle>
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.channels.tokenDescription')}
							</p>
						</ItemContent>
						<ItemActions className="ml-auto w-full flex-none justify-end sm:w-80">
							<Input
								id={`${providerId}-token`}
								type="password"
								autoComplete="off"
								value={credential.apiKey}
								onChange={(event) => setCredential({ ...credential, apiKey: event.target.value })}
								onBlur={() => void save(credential)}
								placeholder={t('settings.channels.tokenPlaceholder')}
								className={SETTINGS_INPUT_CLASS}
								aria-label={t('settings.channels.token')}
							/>
						</ItemActions>
					</Item>

					<Item variant="outline" size="md" className="border-b border-border/60 px-5 py-4">
						<ItemMedia variant="icon">
							<ShieldCheck className="size-3" strokeWidth={1.8} />
						</ItemMedia>
						<ItemContent className="min-w-0 flex-col items-start gap-0.5">
							<ItemTitle>{t('settings.channels.dmPolicy')}</ItemTitle>
							<p className="text-[11px] leading-4 text-muted-foreground">
								{t('settings.channels.dmPolicyDescription')}
							</p>
						</ItemContent>
						<ItemActions className="ml-auto w-full flex-none justify-end sm:w-56">
							<select
								value={credential.dmPolicy ?? 'allowlist'}
								onChange={(event) => {
									void save({ ...credential, dmPolicy: event.target.value as ChannelDmPolicy });
								}}
								className="h-8 rounded-md border border-input bg-background px-2 text-xs"
							>
								{CHANNEL_DM_POLICIES.map((policy) => (
									<option key={policy} value={policy}>
										{t(`settings.channels.dmPolicies.${policy}`)}
									</option>
								))}
							</select>
						</ItemActions>
					</Item>

					<Item
						variant="outline"
						size="md"
						className="flex-col items-stretch gap-3 border-b border-border/60 px-5 py-4"
					>
						<div className="flex w-full min-w-0 items-start gap-3">
							<ItemMedia variant="icon">
								<UserRound className="size-3" strokeWidth={1.8} />
							</ItemMedia>
							<div className="min-w-0 flex-1">
								<ItemTitle className="w-full">{t('settings.channels.allowFrom')}</ItemTitle>
								<p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
									{t('settings.channels.allowFromDescription')}
								</p>
							</div>
						</div>
						<ListEditor
							id={`${providerId}-allow-from`}
							value={listDrafts.allowFrom}
							items={credential.allowFrom ?? []}
							placeholder={t('settings.channels.allowFromPlaceholder')}
							addLabel={t('settings.channels.addAllowFrom')}
							removeLabel={(item) => t('settings.channels.removeAllowFrom', { value: item })}
							emptyLabel={t('settings.channels.noAllowFrom')}
							onDraftChange={(value) =>
								setListDrafts((current) => ({ ...current, allowFrom: value }))
							}
							onAdd={() => addListValue('allowFrom')}
							onRemove={(value) => removeListValue('allowFrom', value)}
						/>
					</Item>
					<Item variant="outline" size="md" className="flex-col items-stretch gap-3 px-5 py-4">
						<div className="flex w-full min-w-0 items-start gap-3">
							<ItemMedia variant="icon">
								<Hash className="size-3" strokeWidth={1.8} />
							</ItemMedia>
							<div className="min-w-0 flex-1">
								<ItemTitle className="w-full">{t('settings.channels.groupAllowFrom')}</ItemTitle>
								<p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
									{t('settings.channels.groupAllowFromDescription')}
								</p>
							</div>
						</div>
						<ListEditor
							id={`${providerId}-group-allow-from`}
							value={listDrafts.groupAllowFrom}
							items={credential.groupAllowFrom ?? []}
							placeholder={t('settings.channels.groupAllowFromPlaceholder')}
							addLabel={t('settings.channels.addGroupAllowFrom')}
							removeLabel={(item) => t('settings.channels.removeGroupAllowFrom', { value: item })}
							emptyLabel={t('settings.channels.noGroupAllowFrom')}
							onDraftChange={(value) =>
								setListDrafts((current) => ({ ...current, groupAllowFrom: value }))
							}
							onAdd={() => addListValue('groupAllowFrom')}
							onRemove={(value) => removeListValue('groupAllowFrom', value)}
						/>
					</Item>
				</Card>
			) : (
				<SettingsNotice variant="destructive">
					{t('settings.channels.notConfigured')}
				</SettingsNotice>
			)}
		</SettingsPageShell>
	);
};

function ListEditor({
	id,
	value,
	items,
	placeholder,
	addLabel,
	removeLabel,
	emptyLabel,
	onDraftChange,
	onAdd,
	onRemove,
}: {
	readonly id: string;
	readonly value: string;
	readonly items: readonly string[];
	readonly placeholder: string;
	readonly addLabel: string;
	readonly removeLabel: (item: string) => string;
	readonly emptyLabel: string;
	readonly onDraftChange: (value: string) => void;
	readonly onAdd: () => void;
	readonly onRemove: (value: string) => void;
}): React.JSX.Element {
	const canAdd = value.trim().length > 0;

	return (
		<div className="flex w-full min-w-0 flex-col gap-2">
			<div className="flex h-8 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background/70 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
				<input
					id={id}
					value={value}
					onChange={(event) => onDraftChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && canAdd) {
							event.preventDefault();
							onAdd();
						}
					}}
					placeholder={placeholder}
					className="min-w-0 flex-1 border-0 bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
					aria-label={placeholder}
				/>
				<div className="flex shrink-0 items-center border-l border-input px-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="size-6"
						disabled={!canAdd}
						onClick={onAdd}
						aria-label={addLabel}
						title={addLabel}
					>
						<Plus className="size-3" />
					</Button>
				</div>
			</div>

			<div className="rounded-lg border border-border/70 bg-muted/20 p-2">
				{items.length > 0 ? (
					<ul className="flex flex-col gap-1">
						{items.map((item) => (
							<li
								key={item}
								className="flex min-h-8 items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1"
							>
								<span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
									{item}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									onClick={() => onRemove(item)}
									className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
									aria-label={removeLabel(item)}
								>
									<X className="size-3" />
								</Button>
							</li>
						))}
					</ul>
				) : (
					<p className="px-1 py-3 text-center text-[11px] leading-4 text-muted-foreground">
						{emptyLabel}
					</p>
				)}
			</div>
		</div>
	);
}

function blankCredential(providerId: string, service: CatalogService | null): StoredChannelProvider {
	return {
		id: providerId,
		name: service?.provider.name ?? providerId,
		apiKey: '',
		baseUrl: service?.url ?? '',
		allowFrom: [],
		groupAllowFrom: [],
		dmPolicy: 'allowlist',
	};
}

export default ChannelDetailPage;
