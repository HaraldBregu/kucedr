import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, LoaderCircle, Pencil } from 'lucide-react';
import type { CatalogService } from '@shared/provider_types';
import { ProviderAvatar } from '@/components/provider-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { openExternalUrl } from '@/lib/external-links';
import { SettingsNotice } from '../../components';

interface TelegramConnectionProps {
	readonly service: CatalogService;
	readonly configured: boolean;
	readonly onSaved: () => void;
}

export function TelegramConnection({
	service,
	configured,
	onSaved,
}: TelegramConnectionProps): React.JSX.Element {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);
	const [token, setToken] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const provider = service.provider;
	return (
		<Card size="sm" className="p-0!">
			<CardContent className="space-y-3 p-3!">
				<div className="flex items-center gap-2.5">
					<ProviderAvatar
						providerId={provider.id}
						name={provider.name}
						iconDarkUrl={provider.iconDarkUrl}
						iconLightUrl={provider.iconLightUrl}
					/>
					<div className="min-w-0 flex-1">
						<h2 className="text-sm font-semibold">{provider.name}</h2>
						<p className="text-xs text-muted-foreground">{service.name}</p>
					</div>
					<Badge variant={configured ? 'secondary' : 'outline'}>
						{t(configured ? 'settings.channels.configured' : 'settings.channels.notConfigured')}
					</Badge>
				</div>
				{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
				{editing && (
					<form
						className="space-y-2"
						onSubmit={async (event) => {
							event.preventDefault();
							if (!token.trim() || saving) return;
							setSaving(true);
							setError(null);
							try {
								await window.provider.setChannel({ id: 'telegram', apiKey: token.trim() });
								onSaved();
								setToken('');
								setEditing(false);
							} catch (cause) {
								setError(
									cause instanceof Error ? cause.message : t('settings.modelServices.saveError')
								);
							} finally {
								setSaving(false);
							}
						}}
					>
						<Label htmlFor="telegram-token">{t('settings.channels.bot')}</Label>
						<Input
							id="telegram-token"
							type="password"
							autoComplete="off"
							value={token}
							disabled={saving}
							onChange={(event) => setToken(event.target.value)}
							placeholder={t('settings.channels.telegramTokenPlaceholder')}
						/>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={saving}
								onClick={() => {
									setEditing(false);
									setToken('');
									setError(null);
								}}
							>
								{t('common.cancel')}
							</Button>
							<Button type="submit" size="sm" disabled={saving || !token.trim()}>
								{saving && <LoaderCircle className="size-3.5 animate-spin" />}
								{t('common.save')}
							</Button>
						</div>
					</form>
				)}
				<div className="flex flex-wrap items-center gap-2">
					{!editing && (
						<Button variant="outline" size="sm" onClick={() => setEditing(true)}>
							<Pencil className="size-3.5" />
							{t('common.edit')} {t('settings.channels.bot')}
						</Button>
					)}
					{provider.apiKeyUrl && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => void openExternalUrl(provider.apiKeyUrl!)}
						>
							<ExternalLink className="size-3.5" />
							{t('settings.channels.token')}
						</Button>
					)}
					<Link
						to="/settings/channels/channelDetail/telegram"
						className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{t('settings.channels.configuration')}
						<ChevronRight className="size-3.5" />
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
